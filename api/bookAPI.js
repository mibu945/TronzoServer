import User from '../mongoDB/models/user';
import Book from '../mongoDB/models/book';
import Article from '../mongoDB/models/article';
import Image from '../mongoDB/models/image';
import Auth from './auth';
import Fs from 'fs';
import Ip from 'public-ip';

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

function findBook(req, condition, cb) {
    Book.find(condition).sort('browserNum')
	.limit(100)
    .populate("author", "name profilePic")
    .populate("sections", "title")
    .exec((err, books) => {
	    if(err || !books) {
	        cb(err, books);
	    } else {
	        Ip.v4().then(ipv4 => {
		        var tmp = JSON.parse(JSON.stringify(books));
                Auth.auth(req, (err2, token) => {
                    function isExist(user){
                        return user === token._id;
                    }
                    function mapFunction(book) {
                        if(book.cover != null) {
                            book.cover = "http://" + ipv4 + ":3000/get/image?id=" + book.cover;
                        }
                        if(book.author.profilePic != null) {
                            book.author.profilePic = "http://" + ipv4 + ":3000/get/image?id=" + book.author.profilePic;
                        }
                        book.likes = book.likeUsers.length;
                        book.stores = book.storeUsers.length;
                        if(book.likeUsers.find(isExist) != null) {
                            book.isLike = true;
                        } else {
                            book.isLike = false;
                        }

                        if(book.storeUsers.find(isExist) != null) {
                            book.isStore = true;
                        } else {
                            book.isStore = false;
                        }
                        return book;
                    }
                    return cb(err, tmp.map(mapFunction));
	            });
            });
        }		
	});
}

export default class BookAPI {
    static postImage(req, res) {
    	console.log(req.image);
	return handleSuccess(res);
    }

    static getBooksDefault(req, res) {
 	findBook(req, null, (err, books) => {
        if(err || !books) return handleError(err, res);
            res.json(books);
        });
    }
    static getBooksByTitle(req, res) {
        const title = req.query.title;
 	    findBook(req, {title: title }, (err, books) => {
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

    //取得book's第n章內容
    static getBookSection(req, res) {
        const bookID = req.query.bookID;
        const num = req.query.num;
        if(!bookID || !num){
            return handleError("non-valid input", res);
        }
        Book.findOne({_id: bookID}, (err, book) => {
            if(err || !book || num > book.sections.length){
                return handleError(err, res);
            }
            Article.findOne({_id: book.sections[num - 1]}, (err, article) => {
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
        const cover = req.files.cover;
	    console.log(cover.size);
        //console.log();
	    if(!title || !type || !cover) {
            return handleError("non-valid input", res);
        }
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
                    handleSuccess(res);
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
                return handleSuccess(res);
            });
        });
    }
    //發表新篇章
    static postBookSection(req, res) {
        const bookID = req.body.bookID;
        const title = req.body.contentTitle;
        
        if(!title || !bookID) {
            return handleError("non-valid input", res);
        }
        Auth.auth(req, (err, token) => {
            if(err) {
               return handleError(err, res);
            }
            Book.findOne({_id: bookID, author: token._id}, (err, book) => {
                if(!book || err){
                    return handleError(err, res);
                }
                Article.create({title: title}, (err, article) => {
                    if(err || !article){
                        return handleError(err, res);
                    }
                    console.log("create suc");
                    Book.update({_id: bookID}, 
                    {$addToSet: {sections: article._id}}, (err) => {
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
            Book.update({_id: bookID, author: token._id},  {$set: {
            title: title, type: type, description: description
            }}, (err) => {
                if(err) {
                    return handleError(err, res);
                }
                return handleSuccess(res);
            });
        });
    }

    //更新章節
    static putBookSection(req, res) {
        const sectionID = req.body.sectionID;
        const title = req.body.title;
        const content = req.body.section;
        
        if(!sectionID || !section || !title) {
            return handleError("non-valid input", res);
        }
        Auth.auth(req, (err, token) => {
            if(err) {
               return handleError(err, res);
            }
            Book.findOne({userID: token._id, sections: {$in: sectionID}}, 
            (err, book) => {
                if(err || !book) {
                    return handleError(err, res);;
                }
                //const b = new Buffer(content);
                Article.update({_id: sectionID}, {$set: {title: title, content}}, (err, article) => {
                    if(err) {
                        return handleError(err, res);;
                    }
                    return handleSuccess(res);
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
                return handleSuccess(res);
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
                return handleSuccess(res);
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
            User.update({_id: token._id}, {$addToSet: {stores: bookID}}, (err) => {
                if(err) {
                    return handleError(err, res);
                }
                Book.update({_id: bookID}, {$addToSet: {storeUsers: token._id}}, (err) => {
                    if(err) {
                        return handleError(err, res);
                    }
                    return handleSuccess(res);
                }); 
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
            User.update({_id: token._id}, {$pull: {stores: bookID}}, (err) => {
                if(err) {
                    return handleError(err, res);
                }
                Book.update({_id: bookID}, {$pull: {storeUsers: token._id}}, (err) => {
                    if(err) {
                        return handleError(err, res);
                    }
                    return handleSuccess(res);
                }); 
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
                return handleSuccess(res);
            });
        });
    }

    //刪除某章節
    static deleteBookSection(req, res) {
        const sectionID = req.body.sectionID;
        if(!sectionID) {
            return handleError("non-valid input", res);
        }/*
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
        });*/
    }
}
