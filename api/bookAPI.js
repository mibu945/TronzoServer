import User from '../mongoDB/models/user';
import Book from '../mongoDB/models/book';
import Article from '../mongoDB/models/article';
import Image from '../mongoDB/models/image';
import Auth from './auth';
import Fs from 'fs';
import Ip from 'public-ip';
import Async from 'async';

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

function handleSuccess(suc, res) {
    suc.suc = "OK";
    res.json(suc);
}

function findBook(req, condition, cb) {
    
    Async.parallel([
        function(cb) {
            Book.find(condition)
            .sort({updateTime: -1})
	        .limit(100)
            .populate("author", "name profilePic")
            .populate("sections", "title")
            .exec(cb);
        },
        function(cb) {
            Auth.auth(req, cb);
        },
        function(cb) {
            Ip.v4().then((ipv4) => {cb(null, ipv4)});
        }
    ], (err, result) => {
        if((err && err[0]) || result[0] == null){
             cb(err, result);
        }
        var tmp = JSON.parse(JSON.stringify(result[0]));
        const token = result[1];
        const ip = result[2];
        function isExist(user){
            return user === token._id;
        }
        cb(null, tmp.map((book) => {
            if(book.cover) {
                book.cover = "http://" + ip + ":3000/get/image?id=" + book.cover;
            }
            if(book.author && book.author.profilePic) {
                book.author.profilePic = "http://" + ip + ":3000/get/image?id=" + book.author.profilePic;
            }
            book.likes = book.likeUsers.length;
            book.stores = book.storeUsers.length;
            book.isLike = (book.likeUsers.find(isExist) != null);
            book.isStore = (book.storeUsers.find(isExist) != null);
            delete book.likeUsers;
            delete book.storeUsers;
            return book;
        }));
    });
}


export default class BookAPI {
    
    static getBooksDefault(req, res) {
 	    findBook(req, {}, (err, books) => {
            if(err || !books) return handleError(err, res);
            res.json(books);
        });
    }
    static getBooksByTitle(req, res) {
        const title = req.query.title;
        const search = new RegExp(title, "i");
 	    findBook(req, {title: search}, (err, books) => {
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
	    findBook(req, {author: userID }, (err, books) => {
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
        findBook(req, {_id: bookID}, (err, book) => {
            if(err || !book){
                return handleError(err, res);
            }
            res.json(book);
        });
    }

    static getBookSection(req, res) {
        const sectionID = req.query.sectionID;
        if(!sectionID){
            return handleError("non-valid input", res);
        }
        Article.findOne({_id: sectionID}, (err, article) => {
            if(err || !article){
                return handleError(err, res);
            }
            res.json(article);
        });
    }
    
    //創一本新書
    static postBook(req, res) {
        //book data
        const title = req.body.title;
        const type = req.body.type;
        const description = req.body.description;
        const cover = req.files.cover;
	    if(!title || !type || !cover || !cover.size) {
            return handleError("non-valid input", res);
        }
	    console.log(cover.size);
        Auth.auth(req, (err, token) => {
            if(err) {
               return handleError(err, res);
            }
	        const data = Fs.readFileSync(cover.path);
	        Image.create({data: data}, (err, cover) => {
                if(err) {
                    return handleError(err, res);
                }    
                Book.create({author: token._id,
                    title: title,
                    bookType: type,
                    description: description,
                    cover: cover._id
                }, (err, book) => {
                    if(err) {
                        return handleError(err, res);
                    }
                    res.json({_id: book._id});
                });
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
            Book.update({_id: bookID}, {$push: {comments: {author: token._id, content: comment}}}, (err) => {
                if(err){
                    return handleError(err, res);
                }
                return handleSuccess({}, res);
            });
        });
    }
    static postBookSection(req, res) {
        const bookID = req.body.bookID;
        const title = req.body.title;
        
        if(!bookID) {
            return handleError("non-valid input", res);
        }
        Async.parallel([
            function(cb){
                Auth.auth(req, cb);
            },
            function(cb){
                Book.findOne({_id: bookID}, "author", cb);
            },
            function(cb){
                Article.create({title: title}, cb);
            }
        ], (err, result) => {
            if(err) return handleError(err, res);
            const token = result[0];
            const book = result[1];
            const article = result[2];
            if(token._id != book.author) return handleError(err, res);
            Book.update({_id: bookID}, {$addToSet: {sections: article._id}}, (err) => {
                if(err) {
                    return handleError(err, res);
                }
                return handleSuccess({_id: article._id}, res);
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
        
        if(!bookID) {
            return handleError("non-valid input", res);
        }

        Auth.auth(req, (err, token) => {
            if(err) {
               return handleError(err, res);
            }
            var book = {};
            if(title) book.title = title;
            if(type) book.type = type;
            if(description) book.description = description;

            Book.update({_id: bookID, author: token._id},  {$set: book}, (err) => {
                if(err) {
                    return handleError(err, res);
                }
                return handleSuccess({}, res);
            });
        });
    }

    //更新章節
    static putBookSection(req, res) {
        const sectionID = req.body.sectionID;
        const title = req.body.title;
        const content = req.body.content;
        
        if(!sectionID || !content || !title) {
            return handleError("non-valid input", res);
        }
        Auth.auth(req, (err, token) => {
            if(err) {
               return handleError(err, res);
            }
            Book.findOne({author: token._id, sections: {$in: [sectionID]}}, 
            (err, book) => {
                if(err || !book) {
                    return handleError(err, res);;
                }
                Article.update({_id: sectionID}, {$set: {title: title, content: content, wordCnt: content.length}}, (err) => {
                    if(err) {
                        return handleError(err, res);
                    }
                    return handleSuccess({}, res);
                });
            });
        });
    }

    static putLikeBook(req, res) {
        const bookID = req.body.bookID;
        
        if(!bookID) {
            return handleError("non-valid input", res);
        }
        Auth.auth(req, (err, token) => {
            if(err) {
               return handleError(err, res);
            }
            Book.update({_id: bookID}, {$addToSet: {likeUsers: token._id}}, (err) => {
                if(err) {
                    return handleError(err, res);
                }
                return handleSuccess({}, res);
            });  
        });

    }

    static putCancelLikeBook(req, res) {
        const bookID = req.body.bookID;
        
        if(!bookID) {
            return handleError("non-valid input", res);
        }
        Auth.auth(req, (err, token) => {
            if(err) {
               return handleError(err, res);
            }
            Book.update({_id: bookID}, {$pull: {likeUsers: token._id}}, (err) => {
                if(err) {
                    return handleError(err, res);
                }
                return handleSuccess({}, res);
            });  
        });
    }
    static putStoreBook(req, res) {
        const bookID = req.body.bookID;
        if(!bookID) {
            return handleError("non-valid input", res);
        }
        Auth.auth(req, (err, token) => {
            if(err) {
               return handleError(err, res);
            }
            Async.parallel([
                function(cb){
                    User.update({_id: token._id}, {$addToSet: {stores: bookID}}, cb);
                },
                function(cb){
                    Book.update({_id: bookID}, {$addToSet: {storeUsers: token._id}}, cb);       }
            ], (err) => {
                if(err) {
                    return handleError(err, res);
                }
                return handleSuccess({}, res);
            });
        });
    }

    static putCancelStoreBook(req, res) {
        const bookID = req.body.bookID;
        if(!bookID) {
            return handleError("non-valid input", res);
        }
        Auth.auth(req, (err, token) => {
            if(err) {
               return handleError(err, res);
            }
            Async.parallel([
                function(cb){
                    User.update({_id: token._id}, {$pull: {stores: bookID}}, cb);
                },
                function(cb){
                    Book.update({_id: bookID}, {$pull: {storeUsers: token._id}}, cb);           }           
            ], (err) => {
                if(err) {
                    return handleError(err, res);
                }
                return handleSuccess({}, res);
            });
        });
    }

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
                return handleSuccess({}, res);
            });
        });
    }

    //刪除某章節
    static deleteBookSection(req, res) {
        const sectionID = req.body.sectionID;
        if(!sectionID) {
            return handleError("non-valid input", res);
        }

        Auth.auth(req, (err, token) => {
            if(err) {
               return handleError(err, res);
            }
            Book.update({author: token._id}, 
            {$pull: {sections: sectionID}}, (err) => {
                if(err) return handleError(err, res);
                Article.remove({_id: sectionID}, (err) => {
                    if(err) return handleError(err, res);
                    return handleSuccess({}, res);
                });
            });
        });
    }
}
