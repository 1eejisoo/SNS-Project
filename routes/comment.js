//댓글을 위한 라우터

const express = require("express");
const { Comment } = require("../models");
const { isLoggedIn } = require("./middlewares");

const router = express.Router();

//post - 댓글 등록 
router.post('/', isLoggedIn, async (req, res, next) => {    
  try {
      const comment = await Comment.create({
          postId: req.body.postId,
          commenter: req.user.id,
          comment: req.body.comment,});
      res.redirect(`/${req.body.postId}`);
      //res.status(201).json(comment);
  } catch (err) {
      console.error(err);
      next(err);
  }
});

//댓글 삭제 기능 구현
// 삭제 버튼을 누르면 isDeleted =
router.post('/:commentId', isLoggedIn, (async (req, res, next) => {   
  try {
      const result = await Comment.update( 
          { isDeleted : 1 },
          { where: { id: req.params.commentId } }
      );
      //res.json(result);
      res.redirect(`/${req.body.postId}`);
  } catch (err) {
      console.error(err);
      next(err);
      }
}
));

module.exports = router;
