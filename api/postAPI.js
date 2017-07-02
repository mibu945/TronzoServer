import Post from '../mongoDB/models/post';
import User from '../mongoDB/models/user';
import Book from '../mongoDB/models/book';
import Auth from './auth';
import Utility from './utility';
import Async from 'async';

const SHAREWEIGHT = 300;
const COMMENTWEIGHT = 30;
const LIKEWEIGHT = 15;


function _findPost(condition, cb, limit = 100, sort = {createTime: -1}) {
    return Post
    .find(condition)
    .sort(sort)
    .limit(limit)
    .populate("author", "name profilePic")
    .populate("comments.author", "name profilePic")
    .populate({
        path: "book",
        select: "title cover description author",
        populate: {
            path: "author",
            select: "name profilePic"
        }
    })
    .exec(cb);
}

function _returnPosts(posts, req, cb) {
    Async.waterfall([
        function(cb) {
            Auth.auth(req, (err, token) => {
                cb(null, token);
            });
        },
        function(token, cb) {
            if(token) User.findOne({_id: token._id}, "_id", cb);
            else cb(null, null);
        }
    ], (err, result) => {
        if(err) return cb([]);
        const user = result;
        
	    var tmp = JSON.parse(JSON.stringify(posts));
        function isExist(tmp) { return user ? tmp == user._id : false; }
        return cb(tmp.map((post) => {
            post.type = "post";
            post.author.profilePic = Utility.transCompleteAddress(post.author.profilePic);
            post.book.author.profilePic = Utility.transCompleteAddress(post.book.author.profilePic);
            post.book.cover = Utility.transCompleteAddress(post.book.cover);
            
            post.comments = post.comments.map((comment) => {
                comment.author.profilePic = Utility.transCompleteAddress(comment.author.profilePic);
                return comment;
            });
            post.shares = post.shareUsers ? post.shareUsers.length : 0;
            
            if(post.likeUsers) {
                post.isLike = ( post.likeUsers.find(isExist) != null);
                post.likes = post.likeUsers.length;
            } else {
                post.isLike = false;
                post.likes = 0;
            }

            delete post.likeUsers;
            delete post.shareUsers;
            delete post.updateTime;
            return post;
        }));
    });
}



export default class PostAPI {

    static resetPoint() {
        Point.update({}, {point: 0}, (err) => {});
    }

    static findPost(condition, cb, limit = 100, sort = {createTime: -1}) {
        return _findPost(condition, cb, limit, sort);
    }

    static returnPosts(posts, req, cb) {
        return _returnPosts(posts, req, cb);
    }
    static getPostByID(req, res) {
        const postID = req.query.postID;
        
        if(!postID) return Utility.handleError("non-valid input", res);
        _findPost(req, {_id: postID}, (err, post) => {
            if(err) return Utility.handleError(err, res);
            _returnPosts(posts, req, (posts) => {
                res.json(posts);
            });
        });
    }
    static getPostsByUser(req, res) {
        const userID = req.query.userID;
        if(!userID) return Utility.handleError("non-valid input", res);
	    findPost(req, {author: userID }, (err, posts) => {
            if(err || !posts) return Utility.handleError(err, res);
            res.json(posts);
        });
    }
    static postPost(req, res) {
        const bookID = req.body.bookID;
        const content = req.body.content;
        if(!bookID || !content) return Utility.handleError("non-valid input", res);
        
        Auth.auth(req, (err, token) => {
            if(err) return Utility.handleError(err, res);
            Book.findOne({_id: bookID}, (err, book) => {
                if(err || !book) return Utility.handleError(err, res);
                Post.create({author: token._id, book: bookID, content: content}, (err, post) => {
                    if(err) return Utility.handleError(err, res);
                    res.json({_id: post._id})
                }); 
            });
        });
    }
    
    static postPostComment(req, res) {
        const postID = req.body.postID;
        const content = req.body.content;
        if(!postID || !content) return Utility.handleError("non-valid input", res);
        Auth.auth(req, (err, token) => {
            if(err) return Utility.handleError(err, res);
            const comment = {author: token._id, content: content};
            Post.findOneAndUpdate({_id: postID}, {$push: {comments: comment}}, (err, post) => {
                if(err) return Utility.handleError(err, res);
                Post.findOne({_id: postID}, (err, post) => {
                    if(err || !post) return Utility.handleError(err, res);
                    
                    Post.update({_id: postID}, {$inc: {point: COMMENTWEIGHT}}, {strict: false}, (err) => {});
                    return Utility.handleSuccess({_id: post.comments[post.comments.length - 1]._id}, res);
                });
            });
        });
    }
    static deletePostComment(req, res) {
        const commentID = req.body.commentID;
        if(!commentID) return Utility.handleError("non-valid input", res);
        Auth.auth(req, (err, token) => {
            if(err) return Utility.handleError(err, res);
            Post.findOne({"comments._id": commentID}, "_id author comments", (err, post) => {
                if(err || !post) return Utility.handleError(err, res);
                var index = post.comments.findIndex((comment) => {
                    return comment._id == commentID; 
                });
                if(post.author != token._id && post.comments[index].author != token._id) {
                    return Utility.handleError("You did not use its authority", res);
                }
                Post.update({_id: post._id}, {$pull: {comments: post.comments[index]}}, {strict: false}, (err) => {
                    if(err) return Utility.handleError(err, res);
                    Post.update({_id: post._id}, {$inc: {point: -1 * COMMENTWEIGHT}}, {strict: false}, (err) => {});
                    return Utility.handleSuccess({}, res);
                }); 
            }); 
        });
    }

    static putPost(req, res) {
        const postID = req.body.postID;
        const content = req.body.content;
        if(!postID || !content) return Utility.handleError("non-valid input", res);
        Auth.auth(req, (err, token) => {
            if(err) return Utility.handleError(err, res);
            Post.update({_id: postID, author: token._id}, {$set: {content: content}}, (err) => {
                if(err) return Utility.handleError(err, res);
                return Utility.handleSuccess({}, res);
            });
        });

    }
    static putLikePost(req, res) {
        console.log("likePost");
        const postID = req.body.postID;
        
        if(!postID) return Utility.handleError("non-valid input", res);
        Auth.auth(req, (err, token) => {
            if(err) return Utility.handleError(err, res);
            Post.update({_id: postID}, {$addToSet: {likeUsers: token._id}}, {strict: false} , (err) => {
                if(err) return Utility.handleError(err, res);
                Post.update({_id: postID}, {$inc: {point: LIKEWEIGHT}}, {strict: false}, (err) => {});
                return Utility.handleSuccess({}, res);
            });  
        });

    }

    static putCancelLikePost(req, res) {
        const postID = req.body.postID;
        
        if(!postID) return Utility.handleError("non-valid input", res);
        Auth.auth(req, (err, token) => {
            if(err) return Utility.handleError(err, res);
            Post.update({_id: postID}, {$pull: {likeUsers: token._id}}, {strict: false}, (err) => {
                if(err) return Utility.handleError(err, res);
                Post.update({_id: postID}, {$inc: {point: -1 * LIKEWEIGHT}}, {strict: false}, (err) => {});
                return Utility.handleSuccess({}, res);
            });  
        });
    }
    static putSharePost(req, res) {
        const postID = req.body.postID;
        if(!postID) return Utility.handleError("non-valid input", res);
        Auth.auth(req, (err, token) => {
            if(err) return Utility.handleError(err, res);
            Post.findOneAndUpdate({_id: postID}, {$addToSet: {shareUsers: token._id}}, {strict: false}, (err, book) => {
                if(err) return Utility.handleError(err, res);
                Post.update({_id: postID}, {$inc: {point: SHAREWEIGHT}}, {strict: false}, (err) => {});
                return Utility.handleSuccess({}, res);
            });  
        });
    }


    static deletePost(req, res) {
        const postID = req.body.postID;
        if(!postID) return Utility.handleError("non-valid input", res);
        Auth.auth(req, (err, token) => {
            if(err) return Utility.handleError(err, res);
            Post.remove({_id: postID, author: token._id}, (err) => {
                if(err) return Utility.handleError(err, res);
                return Utility.handleSuccess({}, res);
            });
        });
    }   
}
