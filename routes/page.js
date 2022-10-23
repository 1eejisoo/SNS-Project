const express = require("express");
const TimeCounting = require("time-counting"); //타임카운트 패키지
const { isLoggedIn, isNotLoggedIn } = require("./middlewares");
const { Post, User, Comment, Hashtag, sequelize } = require("../models");

const router = express.Router();

router.use((req, res, next) => {
  res.locals.user = req.user;
  res.locals.followerCount = req.user ? req.user.Followers.length : 0;
  res.locals.followingCount = req.user ? req.user.Followings.length : 0;
  res.locals.followerIdList = req.user
    ? req.user.Followings.map((f) => f.id)
    : [];
  next();
});

var imglink;

module.exports = router;

router
  .route("/profile") //프로필 관련 라우터
  .get(isLoggedIn, async (req, res) => {
    res.render("profile", { title: "Profile - prj-name" });
  })
  .post(isLoggedIn, async (req, res) => {//프로필 수정을 눌렀을시
    nickk = req.body.nick;
    my_idd = req.body.my_id;
    statuss = req.body.statuss;

    try {
      await User.update( //form에 입력한 닉네임과 상태메시지로 바꾼다
        {
          nick: nickk,
          status: statuss,
        },
        {
          where: { id: my_idd },
        }
      );
    } catch (err) {
      console.error(err);
    }
    return res.redirect("/profile");
  });

router.get("/join", isNotLoggedIn, (req, res) => {
  res.render("join", { title: "Join to - prj-name" });
});


router
  .get("/", async (req, res, next) => {
    try {
      const posts = await Post.findAll({
        include: {
          model: User,
          attributes: ["id", "nick"],
        },
        order: [["createdAt", "DESC"]],
        where: { isDeleted: 0 }, //삭제되지 않은 글만
      });

      const countQuery =
      "SELECT P.id, COUNT(CASE WHEN C.isDeleted=0 THEN 1 END) as count FROM posts as P LEFT JOIN comments as C on P.id = C.postId WHERE p.isDeleted=0 GROUP BY P.id  ORDER BY P.createdAt desc";
      const commentsCount = await sequelize.query(countQuery, {
        type: sequelize.QueryTypes.SELECT,
        raw: true,
      });
      console.log(commentsCount); 

      res.render("main", {
        title: "prj-name",
        twits: posts,
        commentsCount: commentsCount, // commentsCount 추가
      });
    } catch (err) {
      console.error(err);
      next(err);
    }
  })
  //홈버튼 눌렀을때, 글 삭제했을 때
  .post("/", async (req, res, next) => {
    const del = req.body.del; 
    try {
      if (del) {
        // await Post.destroy({ where: { id: req.body.id } });
        //삭제하는것 대신 isDeleted를 1로 바꾼다
        await Post.update({ isDeleted: 1 }, { where: { id: req.body.id } })
        .then(Comment.update({isDeleted : 1}, {where : {postId: req.body.id}})); //댓글도 함께 바꾼다
      }

      const posts = await Post.findAll({
        include: {
          model: User,
          attributes: ["id", "nick"],
        },
        order: [["createdAt", "DESC"]],
        where: { isDeleted: 0 },
      });
      // 메인 페이지에서 댓글 개수를 표시하기 위해 추가
      const countQuery =
        "SELECT P.id, COUNT(CASE WHEN C.isDeleted=0 THEN 1 END) as count FROM posts as P LEFT JOIN comments as C on P.id = C.postId WHERE p.isDeleted=0 GROUP BY P.id  ORDER BY P.createdAt desc";
      const commentsCount = await sequelize.query(countQuery, {
        type: sequelize.QueryTypes.SELECT,
        raw: true,
      });
      console.log(commentsCount); 
      res.render("main", {
        title: "prj-name",
        twits: posts,
        commentsCount: commentsCount, // commentsCount 추가
      });
    } catch (err) {
      console.error(err);
      next(err);
    }
  });

router.get("/hashtag", async (req, res, next) => {
  const query = req.query.hashtag;
  if (!query) {
    return res.redirect("/");
  }
  try {
    const hashtag = await Hashtag.findOne({ where: { title: query} });
    let posts = [];
    if (hashtag) {
      posts = await hashtag.getPosts({where:{isDeleted:0} ,include: [{ model: User }] }); //isdeleted가 0인 해시태그 달린 글만 검색되도록
    }

    return res.render("main", {
      title: `${query} | NodeBird`,
      twits: posts,
    });
  } catch (error) {
    console.error(error);
    return next(error);
  }
});

router //게시글을 눌렀을때 글 내용
  .get("/:id", async (req, res, next) => {
    const postId = req.params.id;
    try {
      const post = await Post.findOne({
        where: { id: postId },
        include: [
          {
            model: User,
            attributes: ["id", "nick"],
          },
        ],
      });

      //댓글 작성시간을 표시하기 위해 필요한 코드들을 추가하였음
      // 상세페이지에서 댓글 로딩
      const comments = await Comment.findAll({
        include: [
          {
            model: User,
            attributes: ["id", "nick"],
          },
          {
            model: Post,
            attributes: ["id"],
          },
        ],
        order: [["created_at", "DESC"]],
      });
      const dateQuery = "select id, postId, created_at from comments where isDeleted=0" //isDeleted가 0인 것들만
      // 댓글들의 작성시간들을 query로 뽑아 생성
      const commentsDate = await sequelize.query(dateQuery, {
        type: sequelize.QueryTypes.SELECT,
        raw: true,
      });
      for (var idx in commentsDate) {
        // time-counting 패키지를 사용하여 댓글 작성시간을 3분전, 1개월전 이런식으로 나올 수 있게 수정하여 새로운 변수 생성
        commentsDate[idx].created_at = TimeCounting.default(
          commentsDate[idx].created_at,
          { lang: "ko", calculate: { justNow: 60 } }
        );
      }
      //console.log(commentsDate);
      res.render("detail", {
        title: "글 상세보기",
        twit: post,
        comments: comments,
        commentsDate: commentsDate, // 댓글 작성시간도 detail.html에 내보내줌
      });
    } catch (err) {
      console.error(err);
      next(err);
    }
  })
  //글 수정완료버튼 누르고 상세화면으로 돌아올때
  .post("/edit:id", async (req, res, next) => {
    const content = req.body.content;
    const postId = req.params.id;
    const url = req.body.url;
    const deletee=req.body.imagedelete; //이미지 삭제위한 변수

    try {
      if(deletee=="delete"){ //만약 이미지를 새로 안올렸고 삭제만 했을 경우
        await Post.update(
          { img: "" },
          { where: { id: req.params.id } }
        );
      }
      else if (url) {
        await Post.update( //이미지 수정을 했을경우
          { img: url },
          { where: { id: req.params.id } }
        );
      }
      if (content) { //글 수정을 했을 경우
        await Post.update(
          { content: content },
          { where: { id: req.params.id } }
        );
        
      }
      const post = await Post.findOne({
        where: { id: postId },
        include: {
          model: User,
          attributes: ["id", "nick"],
        },
      });
      //댓글 작성시간을 표시하기 위해 필요한 코드들을 추가하였음
      // 상세페이지에서 댓글 로딩
      const comments = await Comment.findAll({
        include: [
          {
            model: User,
            attributes: ["id", "nick"],
          },
          {
            model: Post,
            attributes: ["id"],
          },
        ],
        order: [["created_at", "DESC"]],
      });
      const dateQuery = "select id, postId, created_at from comments where isDeleted=0";
      // 댓글들의 작성시간들을 query로 뽑아 생성
      const commentsDate = await sequelize.query(dateQuery, {
        type: sequelize.QueryTypes.SELECT,
        raw: true,
      });
      for (var idx in commentsDate) {
        // time-counting 패키지를 사용하여 댓글 작성시간을 3분전, 1개월전 이런식으로 나올 수 있게 수정하여 새로운 변수 생성
        commentsDate[idx].created_at = TimeCounting.default(
          commentsDate[idx].created_at,
          { lang: "ko", calculate: { justNow: 60 } }
        );
      }
      //console.log(commentsDate);
      res.render("detail", {
        title: "글 상세보기",
        twit: post,
        comments: comments,
        commentsDate: commentsDate, // 댓글 작성시간도 detail.html에 내보내줌
      });
    } catch (err) {
      console.error(err);
      next(err);
    }
  });

//수정버튼 눌렀을때
router.post("/edit", async (req, res, next) => {
  try {
    const img = req.body.img;
      if(img){
        await Post.update(
          { img: "" },
          { where: { id: req.body.id } }
        );
      }
    const posts = await Post.findAll({
      include: {
        model: User,
        attributes: ["id", "nick"],
      },
      order: [["createdAt", "DESC"]],
      where: { id: req.body.id },
    });
    // console.log(posts)
    res.render("edit", {
      title: "prj-name",
      twits: posts,
    });
  } catch (err) {
    console.error(err);
    next(err);
  }
});

router.post("/user/:id", async (req, res, next) => {//유저 프로필 보기 post 메소드
  const user_id = req.body.user_id; //프로필 볼 사람의 id
  const my_id = req.body.my_id; //내 id
  try {
    const user = await User.findOne({
      where: { id: user_id }, //프로필 볼 사람의 id 유저정보를 가져와서
    });
    res.render("information", {
      //information.html 파일에 렌더링한다
      title: "유저",
      user: user,
    });
  } catch (err) {
    console.error(err);
    next(err);
  }
});

router
  .route("/like") //좋아요 누르기 post메소드
  .post(isLoggedIn, async (req, res) => {
    user_id = req.body.user_id;
    twit_id = req.body.twit_id;
    detail = req.body.detail;
    like = parseInt(req.body.like); //현재 like 숫자를 가져온다
    var likecount;
    try {
      //현재 글의 like숫자를 가져온다
      likecount = await Post.findOne({
        where: { id: twit_id },
      });
    } catch (err) {
      console.error(err);
    }
    const likelist = likecount.wholike.split(" "); //좋아요 누른 사람들 split으로 분할해서 저장
    try {
      if (likelist.indexOf(user_id) < 0) { //만약 like를 누르지 않았다면
        likelist.push(user_id); //likelist에 현재 유저의 id를 집어넣고
        var likelist2 = "";
        for (var i in likelist) {
          likelist2 = likelist2 + " " + likelist[i]; //for문을 돌면서 새로운 좋아요 목록을 만든다 (배열을 데이터베이스에 String으로 저장)
        }
        await Post.update(
          //wholike를 수정하고
          {
            wholike: likelist2.trim(),
          },
          {
            where: { id: twit_id },
          }
        );
        await Post.update(
          //like를 +1한다
          {
            like: like + 1,
          },

          {
            where: { id: twit_id },
          }
        );
      } else if (likelist.indexOf(user_id) >= 0) {//만약 like를 누른 유저라면
        var likelist2 = "";
        for (var i in likelist) {
          if (!(likelist[i] === user_id))
            //현재 like를 누른 유저를 제외하고 좋아요를 저장한다
            likelist2 = likelist2 + " " + likelist[i]; //새로운 좋아요 목록 (배열을 String으로 변경)
        }
        await Post.update(
          //wholike를 수정하고
          {
            wholike: likelist2.trim(),
          },
          {
            where: { id: twit_id },
          }
        );
        await Post.update(
          //like를 -1한다
          {
            like: like - 1,
          },

          {
            where: { id: twit_id },
          }
        );
      }
    } catch (err) {
      console.error(err);
    }
    if (detail == "detail") return res.redirect("/" + twit_id);
    else if (detail == "main") res.redirect("/");
  });
