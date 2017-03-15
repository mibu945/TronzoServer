import User from '../mongoDB/models/user';
import Book from '../mongoDB/models/book';
import Article from '../mongoDB/models/article';
import Auth from './auth';

function handleError(err, res) {
    console.log(err + " in BookAPI");
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

function handleSuccess(res) {
   res.json({suc: "ok"});
}


export default class BookAPI {
    static getBooksByTitle(req, res) {
        console.log("getTitle");
        const title = req.query.title;
        Book.find({title: title })
        .populate("userID", "account")
        .populate("comments.userID", "account")
        .populate("likeUsers", "account")
        .populate("contents", "title")
        .exec((err, books) => {
            if(err || !books) return handleError(err, res);
            res.json(books);
        });
    }
    //取得某user's發表哪些書
    static getBooksByUser(req, res) { 
        const userID = req.query.userID;
        if(!userID){
            return handleError("non-valid input", res);
        }
        Book.find({userID: userID })
        .populate("userID", "account")
        .populate("comments.userID", "account")
        .populate("likeUsers", "account")
        .populate("contents", "title")
        .exec((err, books) => {
            if(err || !books) return handleError(err, res);
            res.json(books);
        });
    }
    //取得book's基本資料
    static getBook(req, res) {
        const bookID = req.query.bookID;
        if(!bookID){
            return handleError("non-valid input", res);
        }
        Book.findOne({_id: bookID}, (err, book) => {
            if(err || !book){
                return handleError(err, res);
            }
            res.json(book);
        });
    }

    //取得book's第n章內容
    static getBookContent(req, res) {
        const bookID = req.query.bookID;
        const num = req.query.num;
        if(!bookID || !num){
            return handleError("non-valid input", res);
        }
        Book.findOne({_id: bookID}, (err, book) => {
            if(err || !book || num > book.contents.size){
                return handleError(err, res);
            }
            Article.findOne({_id: book.content[num - 1]}, (err, article) => {
                if(err || !article) {
                    return handleError(err, res);
                }
                res.json(article);
            });
        });
    }
    
    //創一本新書
    static postBook(req, res) {
        //book data
        const title = req.body.title;
        const type = req.body.type;
        const description = req.body.description;
        
        if(!title || !type || !description) {
            return handleError("non-valid input", res);
        }
        Auth.auth(req, (err, token) => {
            if(err) {
               return handleError(err, res);
            }
            Book.create({userID: token._id,
                title: title,
                type: type,
                description: description
            }, (err, book) => {
                if(err) {
                    return handleError(err, res);
                }
                res.json({title: book.title, description: book.description});
            });
        });
     }
    //在書下留言
    static postBookComment(req, res) {
        const bookID = req.body.bookID;
        const comment = req.body.comment;
        
        if(!bookID || !comment) {
            return handleError("non-valid input", res);
        }
        Auth.auth(req, (err, token) => {
            if(err) {
               return handleError(err, res);
            }
            Book.update({_id: bookID}, {$push: {comments: {userID: token._id, content: comment}}}, (err) => {
                if(err){
                    return handleError(err, res);
                }
                return handleSuccess(res);
            });
        });
    }
    //發表新篇章
    static postBookContent(req, res) {
        const bookID = req.body.bookID;
        const title = req.body.contentTitle;
        
        if(!title || !bookID) {
            return handleError("non-valid input", res);
        }
        Auth.auth(req, (err, token) => {
            if(err) {
               return handleError(err, res);
            }
            Book.findOne({_id: bookID, userID: token._id}, (err, book) => {
                if(!book || err){
                    return handleError(err, res);
                }
                Article.create({title: title, content: ""}, (err, article) => {
                    if(err || !article){
                        return handleError(err, res);
                    }
                    console.log("create suc");
                    Book.update({_id: bookID}, 
                    {$addToSet: {contents: article._id}}, (err) => {
                        if(err) {
                            return handleError(err, res);
                        }
                        return handleSuccess(res);
                    });
                });
            });
        });
    }

    //更新基本資料
    static putBook(req, res) {
        //book data
        const bookID = req.body.bookID;
        const title = req.body.title;
        const type = req.body.type;
        const description = req.body.description;
        
        if(!bookID || !title || !type || !description) {
            return handleError("non-valid input", res);
        }

        Auth.auth(req, (err, token) => {
            if(err) {
               return handleError(err, res);
            }
            Book.update({_id: bookID, UserID: token._id},  {$set: {
            title: title, type: type, content: content
            }}, (err) => {
                if(err) {
                    return handleError(err, res);
                }
                return handleSuccess(res);
            });
        });
    }

    //更新章節
    static putBookContent(req, res) {
        const contentID = req.body.contentID;
        const title = req.body.title;
        const content = req.body.content;
        
        if(!contentID || !content || !title) {
            return handleError("non-valid input", res);
        }
        Auth.auth(req, (err, token) => {
            if(err) {
               return handleError(err, res);
            }
            Book.findOne({userID: token._id, content: {$in: contentID}}, 
            (err, book) => {
                if(err || !book) {
                    return handleError(err, res);;
                }
                //const b = new Buffer(content);
                Article.update({_id: contentID}, {$set: {title: title, content}}, (err, article) => {
                    if(err) {
                        return handleError(err, res);;
                    }
                    return handleSuccess(res);
                });
            });

        });
    }

    //刪除整本書
    static deleteBook(req, res) {
        const bookID = req.body.bookID;

        if(!bookID) {
            return handleError("non-valid input", res);
        }
        Auth.auth(req, (err, token) => {
            if(err) {
               return handleError(err, res);
            }
            //TODO
            Book.remove({_id: bookID, userID: token._id}, (err) => {
                if(err) return handleError(err, res);
                return handleSuccess(res);
            });
        });
    }

    //刪除某章節
    static deleteBookContent(req, res) {
        const contentID = req.body.contentID;
        if(!contentID) {
            return handleError("non-valid input", res);
        }
        Auth.auth(req, (err, token) => {
            if(err) {
               return handleError(err, res);
            }
            Book.update({_id: bookID, userID: token._id}, 
            {$pull: {contents: contentID}}, (err) => {
                if(err) return handleError(err, res);
                Article.remove({_id: contentID}, (err) => {
                    if(err) return handleError(err, res);
                    return handleSuccess(res);
                });
            });
        });
    }
}
