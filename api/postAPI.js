import Post from '../mongoDB/models/post';
import User from '../mongoDB/models/user';
import Book from '../mongoDB/models/book';
import Auth from './auth';
import Ip from 'public-ip';
import Async from 'async';

const SHAREWEIGHT = 300;
const COMMENTWEIGHT = 30;
const LIKEWEIGHT = 15;

function handleError(err, res) {
    console.log(err + " in PostAPI");
    if(!err){
        err = "NO DATA";
        return res.status(400).json({error: err});
    }
    if(err.errmsg) {
        res.status(400).json({error: err.errmsg});
    } else {
        res.status(400).json({error: err});
    }
}
function handleSuccess(suc, res) {
    suc.suc = "OK";
    res.json(suc);
}

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

function _returnPosts(posts, req, cb){
    Async.parallel([
        function(cb) {
            Auth.auth(req, (err, token) => {
                if(err) return cb(null, null);
                User.findOne({_id: token._id}, "_id", cb);
            });
        },
        function(cb) {
            Ip.v4().then((ipv4) => {cb(null, ipv4)});
        }
    ], (err, result) => {
        if(err) {
            console.log(err);
            return cb([]);
        }
        const user = result[0];
        const ip = result[1];
        var tmp = JSON.parse(JSON.stringify(posts));
        function isExist(tmp) {
            if(user) return tmp == user._id;
            return false;
        }
        return cb(tmp.map((post) => {
            post.type = "post";
            //for lookup case
            if(post.author[0])post.author = post.author[0];
            if(post.book[0])post.book = post.book[0];
            if(post.book.author[0])post.book.author = post.book.author[0];

            if(post.author && post.author.profilePic) {
                post.author.profilePic = "http://" + ip + ":3000/get/image?id=" + post.author.profilePic;
            }
            post.comments = post.comments.map(comment => {
                if(comment.author.profilePic){
                    comment.author.profilePic = "http://" + ip + ":3000/get/image?id=" + comment.author.profilePic;
                }
                return comment;
            });
            if(post.book.author && post.book.author.profilePic) {
                post.book.author.profilePic = "http://" + ip + ":3000/get/image?id=" + post.book.author.profilePic;
            }
            if(post.book && post.book.cover) {
                post.book.cover = "http://" + ip + ":3000/get/image?id=" + post.book.cover;
            }
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
        
        if(!postID) {
            return handleError("non-valid input", res);
        }
        _findPost(req, {_id: postID}, (err, post) => {
            if(err) return handleError(err, res);
            _returnPosts(posts, req, (posts) => {
                res.json(posts);
            });
        });
    }
    static getPostsByUser(req, res) {
        const userID = req.query.userID;
        if(!userID) {
            return handleError("non-valid input", res);
        }
	    findPost(req, {author: userID }, (err, posts) => {
            if(err || !posts) return handleError(err, res);
            res.json(posts);
        });
    }
    static postPost(req, res) {
        const bookID = req.body.bookID;
        const content = req.body.content;
        if(!bookID || !content) {
            return handleError("non-valid input", res);
        }
        Auth.auth(req, (err, token) => {
            if(err) {
               console.log("auth fail");
               return handleError(err, res);
            }
            Book.findOne({_id: bookID}, (err, book) => {
                if(err || !book) {
                    return handleError(err, res);
                }
                Post.create({author: token._id, book: bookID, content: content}, (err, post) => {
                    if(err) {
                        return handleError(err, res);
                    }    
                    res.json({_id: post._id})
                }); 
            });
        });
    }
    
    static postPostComment(req, res) {
        const postID = req.body.postID;
        const content = req.body.content;
        if(!postID || !content) {
            return handleError("non-valid input", res);
        }
        Auth.auth(req, (err, token) => {
            if(err) {
               return handleError(err, res);
            }
            const comment = {author: token._id, content: content};
            Post.findOneAndUpdate({_id: postID},  {$push: {comments: comment}}, (err, post) => {
                if(err || !post) {
                    return handleError(err, res);
                }
                Post.findOne({_id: postID}, (err, post) => {
                    if(err || !post) return handleError(err, res);
                    
                    Post.update({_id: postID}, {$inc: {point: COMMENTWEIGHT}}, {strict: false}, (err) => {});
                    return handleSuccess({_id: post.comments[post.comments.length - 1]._id}, res);
                });
            });
        });
    }
    static deletePostComment(req, res) {
        const commentID = req.body.commentID;
        if(!commentID) {
            return handleError("non-valid input", res);
        }
        Auth.auth(req, (err, token) => {
            if(err) {
               return handleError(err, res);
            }
            Post.findOne({"comments._id": commentID}, "_id author comments", (err, post) => {
                if(err || !post) return handleError(err, res);
                var index = post.comments.findIndex((comment) => {
                    return comment._id == commentID; 
                });
                if(post.author != token._id && post.comments[index].author != token._id) {
                    return handleError("You did not use its authority", res);
                }
                Post.update({_id: post._id}, {$pull: {comments: post.comments[index]}}, {strict: false}, (err) => {
                    if(err) {
                        return handleError(err, res);
                    }
                    Post.update({_id: post._id}, {$inc: {point: -1 * COMMENTWEIGHT}}, {strict: false}, (err) => {});
                    return handleSuccess({}, res);
                }); 
            }); 
        });
    }

    static putPost(req, res) {
        const postID = req.body.postID;
        const content = req.body.content;
        if(!postID || !content) {
            return handleError("non-valid input", res);
        }
        Auth.auth(req, (err, token) => {
            if(err) {
               return handleError(err, res);
            }
            Post.update({_id: postID, author: token._id},  {$set: {content: content}}, (err) => {
                if(err) {
                    return handleError(err, res);
                }
                return handleSuccess({}, res);
            });
        });

    }
    static putLikePost(req, res) {
        const postID = req.body.postID;
        
        if(!postID) {
            return handleError("non-valid input", res);
        }
        Auth.auth(req, (err, token) => {
            if(err) {
               return handleError(err, res);
            }

            Post.update({_id: postID}, {$addToSet: {likeUsers: token._id}}, {strict: false} , (err) => {
                if(err) {
                    return handleError(err, res);
                }
                Post.update({_id: postID}, {$inc: {point: LIKEWEIGHT}}, {strict: false}, (err) => {});
                return handleSuccess({}, res);
            });  
        });

    }

    static putCancelLikePost(req, res) {
        const postID = req.body.postID;
        
        if(!postID) {
            return handleError("non-valid input", res);
        }
        Auth.auth(req, (err, token) => {
            if(err) {
               return handleError(err, res);
            }
            Post.update({_id: postID}, {$pull: {likeUsers: token._id}}, {strict: false}, (err) => {
                if(err) {
                    return handleError(err, res);
                }

                Post.update({_id: postID}, {$inc: {point: -1 * LIKEWEIGHT}}, {strict: false}, (err) => {});
                return handleSuccess({}, res);
            });  
        });
    }
    static putSharePost(req, res) {
        const postID = req.body.postID;
        if(!postID) {
            return handleError("non-valid input", res);
        }
        Auth.auth(req, (err, token) => {
            if(err) {
               return handleError(err, res);
            }
            Post.findOneAndUpdate({_id: postID}, {$addToSet: {shareUsers: token._id}}, {strict: false}, (err, book) => {
                if(err) {
                    return handleError(err, res);
                }
                Post.update({_id: postID}, {$inc: {point: SHAREWEIGHT}}, {strict: false}, (err) => {});
                return handleSuccess({}, res);
            });  
        });
    }


    static deletePost(req, res) {
        const postID = req.body.postID;
        if(!postID) {
            return handleError("non-valid input", res);
        }
        Auth.auth(req, (err, token) => {
            if(err) {
               return handleError(err, res);
            }
            Post.remove({_id: postID, author: token._id}, (err) => {
                if(err) {
                    return handleError(err, res);
                }
                return handleSuccess({}, res);
            });
        });
    }   
}
