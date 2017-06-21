import Mongoose from 'mongoose';
import User from '../mongoDB/models/user';
import Book from '../mongoDB/models/book';
import Post from '../mongoDB/models/post';
import Article from '../mongoDB/models/article';
import Image from '../mongoDB/models/image';
import Auth from './auth';
import PostAPI from './postAPI';

import Fs from 'fs';
import Ip from 'public-ip';
import Async from 'async';

const STOREWEIGHT = 500;
const LIKEWEIGHT = 35;
const READWEIGHT = 1;

function toMongoID(_id){
    return Mongoose.Types.ObjectId(_id);
}

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

function mergeBooksAndPosts2(books, posts, cb){
    var merge = books.concat(posts);
    merge = merge.sort((a, b)=>{
        var time1 = (a.type == "book" ? a.updateTime : a.createTime);
        var time2 = (b.type == "book" ? b.updateTime : b.createTime);
        return new Date(time2) - new Date(time1);
    });
    cb(merge);
}
function mergeBooksAndPosts(books, posts, cb){
    var merge = [];
    var i = 0;
    var j = 0;
    var k = 0;
    while (true) {
        if(i >= books.length){
            for(; j < posts.length; ++j){
                merge[k++] = posts[j];
            }
            break;
        }
        if(j >= posts.length){
            for(; i < books.length; ++i){
                merge[k++] = books[i];
            }
            break;
        }
        if(!((k + 1) % 3)){
            merge[k++] = posts[j++];
        } else {
            merge[k++] = books[i++];
        }
    }
    return cb(merge);
}

function _returnBooks(books, req, cb){
    Async.parallel([
        function(cb) {
            Auth.auth(req, (err, token) => {
                if(err) return cb(null, null);
                User.findOne({_id: token._id}, "_id bookHistorys", cb);
            });
        },
        function(cb) {
            Ip.v4().then((ipv4) => {cb(null, ipv4)});
        }
    ], (err, result) => {
        if(err){
            console.log(err);
            return cb([]);
        }
        const user = result[0];
        const ip = result[1];
        var tmp = JSON.parse(JSON.stringify(books));
        function isExist(tmp) {
            if(user) return tmp == user._id;
            return false;
        }
        return cb(tmp.map((book) => {
            book.type = "book";
            if(book.cover) {
                book.cover = "http://" + ip + ":3000/get/image?id=" + book.cover;
            }
            //for lookup case
            if(book.author[0])book.author = book.author[0];
            if(book.author && book.author.profilePic) {
                book.author.profilePic = "http://" + ip + ":3000/get/image?id=" + book.author.profilePic;
            }
            book.shares = book.shareUsers ? book.shareUsers.length : 0;
            
            if(book.likeUsers) {
                book.isLike = ( book.likeUsers.find(isExist) != null);
                book.likes = book.likeUsers.length;
            } else {
                book.isLike = false;
                book.likes = 0;
            }
            if(book.storeUsers) {
                book.isStore = ( book.storeUsers.find(isExist) != null);
                book.stores = book.storeUsers.length;
            } else {
                book.isStore = false;
                book.stores = 0;
            }
            if(user && user.bookHistorys) {
                const his = user.bookHistorys.find((item) => {return item.book == book._id});
                if(his) book.lastReadSection = his.sectionNum;
            }
            //delete book.updateTime;
            delete book.likeUsers;
            delete book.storeUsers;
            delete book.shareUsers;
            return book;
        }));
    });
}


function _findBook(condition, cb, limit = 100, sort = {point : -1}) {
    const find = [
        {
            $match: condition
        }, {
            $lookup: { from: "usermodels", localField: "author", foreignField: "_id", as: "author" }
        }, {   
            $project: {
                author: { _id: true, name: true, profilePic: true },
                title: true,
                cover: true,
                bookType: true,
                description: true,
                sections: true,
                createTime: true,
                readCnt: true,
                storeUsers: true,
                likeUsers: true,
                shareUsers: true,
                point: true,
                updateTime: true
            }
        }, {
            $sort: sort
        }, {
            $limit: limit
        } 
    ];
    Book.aggregate(find, (err, books) => {
        if(err || !books) return cb(err, []);
        Book.populate(books, {path: "sections", select: "title"}, (err, books) => {
            if(err || !books) return cb(err, []);
            return cb(null, books);
        })
    });     
}
function _updateTime(bookID) {
    Book.update({_id: bookID}, {$set: {updateTime: new Date()}}, (err)=>{});
}

export default class BookAPI {
    
    static resetPoint() {
        Book.update({}, {point: 0}, (err) => {});
    }
    static updateTime(bookID) {
        _updateTime(bookID);
    }
    static findBook(condition, cb, limit = 100, sort = {weight : -1}) {
        return _findBook(condition, cb, limit, sort);
    }
    static getBooksDefault(req, res) {
        _findBook({}, (err, books) => {
            if(err) return handleError(err, null);
            _returnBooks(books, req, (books) => {res.json(books);});
        });
    }

    static getRecommendedBooks(req, res) {
        _findBook({}, (err, books) => {
            if(err) return handleError(err, null);
            _returnBooks(books, req, (books) => {res.json(books);});
        });
    }

    static getRecommendedEntries(req, res) {
        _findBook({}, (err, books) => {
            if(err) return handleError(err, null);
            _returnBooks(books, req, (books) => {
                PostAPI.findPost({}, (err, posts) => {
                    if(err) return handleError(err, res);
                    PostAPI.returnPosts(posts, req, (posts) => {
                        mergeBooksAndPosts(books, posts, (merge) => {
                            res.json(merge);
                        });
                    });
                }, 100, {point: -1});
            });
        });
    }
    static getAllStoredBooks(req, res) {
        Auth.auth(req, (err, token) => {
            if(err || !token) return res.json([]);
            User.findOne({_id: token._id}, "stores", (err, user) => {
                if(err || !user) return res.json([]);
                function toMongoID(_id){
                    return Mongoose.Types.ObjectId(_id);
                }
                
                var stores = user.stores.map(toMongoID);

                const condition = {_id: {$in: stores}};
                _findBook(condition, (err, books) => {
                    if(err) return handleError(err, res);
                    _returnBooks(books, req, (books)=> {res.json(books);});
                });  
                  
            });
        });
    }
    static getInterestedBooks(req, res) {
        Auth.auth(req, (err, token) => {
            if(err || !token) return res.json([]);
            User.findOne({_id: token._id}, "stores follows", (err, user) => {
                if(err || !user) return res.json([]);
                function toMongoID(_id){
                    return Mongoose.Types.ObjectId(_id);
                }
                
                var follows = user.follows.map(toMongoID);
                var stores = user.stores.map(toMongoID);

                const condition = {$or: [{author: {$in: follows}}, {_id: {$in: stores}}]};
                _findBook(condition, (err, books) => {
                    if(err) return handleError(err, res);
                    _returnBooks(books, req, (books)=> {res.json(books);});
                });  
                  
            });
        });
    }
    static getFollowEntries(req, res) {
        Auth.auth(req, (err, token) => {
            if(err || !token) return res.json([]);
            User.findOne({_id: token._id}, "stores follows", (err, user) => {
                if(err || !user) return res.json([]);
                const follows = user.follows.map(toMongoID);
                const stores = user.stores.map(toMongoID);

                const condition = {$or: [{author: {$in: follows}}, {_id: {$in: stores}}]};
                const condition2 = {author: {$in: follows}};
                _findBook(condition, (err, books) => {
                    if(err) return handleError(err, res);
                    _returnBooks(books, req, (books) => {
                        PostAPI.findPost(condition2, (err, posts) => {
                            if(err) return handleError(err, res);
                            PostAPI.returnPosts(posts, req, (posts) => {
                                mergeBooksAndPosts2(books, posts, (merge) => {
                                    res.json(merge);
                                });
                            });
                        });
                    });
                });
                /*
                Async.parallel([
                    //find Books
                    function(cb) {
                        const condition = {$or: [{author: {$in: follows}}, {_id: {$in: stores}}]};
                        findBook(condition, (err, books) => {
                            if(err) return handleError(err, res);
                            _returnBooks(books, req, cb);
                        });      
                    },
                    //find Posts
                    function(cb) {
                        const condition = {$or: [{author: {$in: follows}}, {book: {$in: stores}}]};
                        findPost(condition, (err, posts) => {
                            if(err) return handleError(err, res);
                            returnPosts(posts, req, cb);
                        }); 
                    },
                ], (result) => {
                    const books = result[0];
                    const posts = result[0];
                    mergeBooksAndPosts(books, posts, (merge) => {
                        res.json(merge);
                    });
                });*/
            });
        });
    } 
    static getStoredListBooks(req, res) {
        Auth.auth(req, (err, token) => {
            if(err || !token) return res.json([]);
            User.findOne({_id: token._id}, "storedList", (err, user) => {
                if(err || !user) return res.json([]);
                function toMongoID(_id){
                    return Mongoose.Types.ObjectId(_id);
                }
                
                var storedList = user.storedList.map(toMongoID);

                const condition = {_id: {$in: storedList}};
                _findBook(condition, (err, books) => {
                    if(err) return handleError(err, res);
                    var newBooks = [];
                    _returnBooks(books, req, (books) => {
                        storedList.map((_id) => {
                            var book = books.find((book) => {
                                return _id == book._id;
                            });
                            book && newBooks.push(book);
                        });
                        res.json(newBooks);
                    });

                    //_returnBooks(books, req, (books)=> {res.json(books);});
                }, 8);      
            });
        });
    }

    static getHistoricalBooks(req, res) {
        Auth.auth(req, (err, token) => {
            if(err || !token) return res.json([]);
            User.findOne({_id: token._id}, "bookHistorys", (err, user) => {
                if(err || !user) return res.json([]);
                function toMongoID(item){
                    return Mongoose.Types.ObjectId(item.book);
                }
                
                var historys = user.bookHistorys.map(toMongoID);

                const condition = {_id: {$in: historys}};
                _findBook(condition, (err, books) => {
                    if(err) return handleError(err, res);
                    _returnBooks(books, req, (books) => {
                        historys = historys.map((_id) => {
                            return books.find((book) => {return _id == book._id});
                        });
                        res.json(historys);
                    });
                });      
            });
        });
    }

    static getBooksByTitle(req, res) {
        const title = req.query.title;
        const search = new RegExp(title, "i");
        User.find({name: search}, "_id", (err, users) => {
            if(err) return handleError(err, res);
            var tmp = JSON.parse(JSON.stringify(users));
            tmp = tmp.map((user) => {return Mongoose.Types.ObjectId(user._id)});
         
            _findBook({$or: [
                {title: search},
                {author:{$in: tmp}}
            ]}, (err, books) => {
                if(err) return handleError(err, res);
                //res.json(books);
                _returnBooks(books, req, (books)=> {res.json(books);});
            }, 20);    
        });
    }
    //取得某user's發表哪些書
    static getBooksByUser(req, res) { 
        const userID = req.query.userID;
        if(!userID){
            return handleError("non-valid input", res);
        }
        _findBook({author: Mongoose.Types.ObjectId(userID)}, (err, books) => {
            if(err) return handleError(err, res);
            _returnBooks(books, req, (books)=> {res.json(books);});
        });    
    }

    static getEntriesByUser(req, res) { 
        const userID = req.query.userID;
        if(!userID){
            return handleError("non-valid input", res);
        }
        const condition = {author: Mongoose.Types.ObjectId(userID)};
        _findBook(condition, (err, books) => {
            if(err) return handleError(err, res);
            _returnBooks(books, req, (books) => {
                PostAPI.findPost(condition, (err, posts) => {
                    if(err) return handleError(err, res);
                    PostAPI.returnPosts(posts, req, (posts) => {
                        mergeBooksAndPosts2(books, posts, (merge) => {
                            res.json(merge);
                        });
                        //res.json(books);
                    });
                });
            });
        });        /*
Async.parallel([
            //find Books
            function(cb) {
                findBook(condition, (err, books) => {
                    if(err) return handleError(err, res);
                    _returnBooks(books, req, cb);
                });      
            },
            //find Posts
            function(cb) {
                findPost(condition, (err, posts) => {
                    if(err) return handleError(err, res);
                    //console.log(posts);
                    //cb([]);
                    returnPosts(posts, req, cb);
                }); 
            }
        ], (result) => {
            const books = result[0];
            const posts = result[1];
            console.log("ans");
            console.log((books));
            console.log(posts);
            res.json([]);
            mergeBooksAndPosts(books, posts, (merge) => {
                res.json(merge);
            });
        });*/
    }
    //取得book's基本資料
    static getBookByID(req, res) {
        const bookID = req.query.bookID;
        if(!bookID){
            return handleError("non-valid input", res);
        }
        _findBook({_id: Mongoose.Types.ObjectId(bookID)}, (err, books) => {
            if(err) return handleError(err, res);
            _returnBooks(books, req, (books)=> {res.json(books[0]);});
        }); 
    }

    static getBookSection(req, res) {
        var sectionID = req.query.sectionID;
        const bookID = req.query.bookID;
        var num = req.query.num;
        if(!sectionID && (!bookID || !num)){
            return handleError("non-valid input", res);
        }
        Async.parallel([
            //find Logining User
            function(cb){
                Auth.auth(req, (err, token) => {
                    if(err) cb(null, null);
                    else User.findOne({_id: Mongoose.Types.ObjectId(token._id)}, cb);
                });
            },
            //find Book
            function(cb){
                if(bookID && bookID.length == 24) {
                    Book.findOne({_id: bookID}, "_id sections readMeta readCnt", cb);
                } else {
                    Book.findOne({sections: {$in: [sectionID]}}, "_id sections readMeta readCnt", cb);
                }
            },
        ], (err, result) => {
            if(err) return handleError(err, res);
            const user = result[0];
            const book = result[1];
            if(!book) return handleError(err, res);

            if(!sectionID || sectionID.length != 24) {
                if(book.sections.length < num) {
                    return handleError("no the section", res);
                }
                sectionID = book.sections[num - 1];
            } else {
                num = book.sections.indexOf(sectionID) + 1;
            }
            //return the section
            Article.findOne({_id: sectionID}, "title content createTime", (err, article) => {
                if(err || !article){
                    return handleError(err, res);
                }
                //response the section
                res.json(article);
                //set history
                if(user) {
                    var historys = JSON.parse(JSON.stringify(user.bookHistorys));
                    //re push the item for making the item in the first and unique
                    if(!historys) historys = [];
                    historys = historys.filter((item) => {
                        return item.book != book._id;
                    });
                    historys.unshift({book: book._id, section: sectionID, sectionNum: num});
                    User.update({_id: user._id}, {$set: {bookHistorys: historys}}, (err) => {if(err) console.log(err)});
                    if(!user.lastReadTime || ((new Date() - new Date(user.lastReadTime)) / 1000 > 3600)) {
                        User.update({_id: user._id}, {$set: {readBookCnt: user.readBookCnt + 1, lastReadTime: new Date()}}, (err) => {});
                    }
                }
        
                //set readNum
                const ip = req.connection.remoteAddress;
                const index = book.readMeta.findIndex((meta) => {return meta.ip = ip});
                var isNewRead = false;
                if(index >= 0){
                    var newMeta = JSON.parse(JSON.stringify(book.readMeta));
                    var now = new Date();
                    var time = new Date(newMeta[index].time);
                    if((now - time) / 1000 > 3600){
                        newMeta[index].time = now;
                        Book.update({_id: book._id}, {$set: {readMeta: newMeta}}, (err) => {});
                        isNewRead = true;
                    }
                } else {
                    isNewRead = true;
                    Book.update({_id: book._id}, {$push: {readMeta: {ip: ip, time: Date.now()}}}, (err) => {});
                }
                if(isNewRead) {
                    Book.update({_id: book._id}, {$inc: {readCnt: 1, point: READWEIGHT}}, (err) => {});                   
                }
            });
        });
    }
    static getBookComments(req, res) {
        const bookID = req.query.bookID;
        const num = req.query.sectionNum;
        const pageNum = req.query.pageNum;
        const amount = req.query.amount;
        const times = req.query.times;
        var valid = true;
        valid = bookID && num && pageNum && amount && times;
        if(!valid) {
            return handleError("non-valid input", res);
        }
        //console.log("1 ok");    
        //valid = bookID.match(/^[0-9a-fA-F]{24}$/) && pageNum.match("^/d$") && pageNum.match("^/d$") && amount.match("^/d$") && times.match("^/d$");
        
        if(!valid) {
            return handleError("non-valid input", res);
        }
        Book.findOne({_id: bookID}, (err, book) => {
            if(err)return handleError(err, res);
            if(!book || !book.sections || book.sections.length < num) {
                return res.json([]);
            }
            const sectionID = book.sections[num - 1];
            Article.findOne({_id: sectionID}, "comments.content comments.pageNum", (err, article) => {
                if(err) return handleError(err, res);
                if(!article || !article.comments) return res.json([]);
                var comments = JSON.parse(JSON.stringify(article.comments));
                
                var comments = comments
                    .filter((comment) => {
                        return comment.pageNum == pageNum;
                    })
                    .map((comment) => {
                        delete comment.pageNum;
                        return comment;
                    });
                if(amount <= 0 || times <= 0) {
                    return res.json(comments);
                } else {
                    var start = amount * (times - 1);
                    var end = 1 * start + 1 * amount;
                    return res.json(comments.slice(start, end));
                }
                res.json([]);
                
            });
        });
    }
    //創一本新書
    static postBook(req, res) {
        //book data
        const title = req.body.title;
        const type = req.body.type;
        const description = req.body.description;
        var cover = req.body.cover;

	    if(!title || !type || !cover) {
            return handleError("non-valid input", res);
        }
        cover = new Buffer(cover.split(",")[1], 'base64');
        Auth.auth(req, (err, token) => {
            if(err) {
               return handleError(err, res);
            }
	        const data = cover;
	        Image.create({data: data}, (err, cover) => {
                if(err) {
                    return handleError(err, res);
                }    
                Book.create({author: token._id,
                    title: title,
                    bookType: type,
                    description: description,
                    cover: cover._id,
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
        const num = req.body.sectionNum;
        const pageNum = req.body.pageNum;
        const content = req.body.content;
        
        if(!bookID || !content || !num || !pageNum) {
            return handleError("non-valid input", res);
        }
        Auth.auth(req, (err, token) => {
            if(err) {
               return handleError(err, res);
            }
            Book.findOne({_id: bookID}, "sections", (err, book) => {
                if(err || !book || book.sections.length < num) {
                    return handleError("no the section", res);
                }
                const sectionID = book.sections[num - 1];
                Article.findOneAndUpdate(
                    {_id: sectionID}, {
                        $push: {
                            comments: {
                                author: token._id,
                                pageNum: pageNum,
                                content: content
                            }
                        }
                    },
                    (err, article) => {
                        if(err || !article) return handleError(err, res);
                        return handleSuccess({}, res);
                    }
                );
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
            console.log(book);
            console.log(article);
            if(token._id != book.author) return handleError(err, res);
            Book.update({_id: book._id}, {$addToSet: {sections: article._id}}, {strict: false}, (err) => {
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
                    _updateTime(book._id);
                    return handleSuccess({}, res);
                });
            });
        });
    }
    static putShareBook(req, res) {
        const bookID = req.body.bookID;
        if(!bookID) {
            return handleError("non-valid input", res);
        }
        Auth.auth(req, (err, token) => {
            if(err) {
               return handleError(err, res);
            }
            Book.findOneAndUpdate({_id: bookID}, {$addToSet: {shareUsers: token._id}}, (err, book) => {
                if(err) {
                    return handleError(err, res);
                }
                return handleSuccess({}, res);
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

                Book.update({_id: bookID}, {$inc: {point: LIKEWEIGHT}}, (err)=>{});
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

                Book.update({_id: bookID}, {$inc: {point: -1 * LIKEWEIGHT}}, (err)=>{});
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
                    Book.update({_id: bookID}, {$addToSet: {storeUsers: token._id}}, cb);       
                }
            ], (err) => {
                if(err) {
                    return handleError(err, res);
                }
                Book.update({_id: bookID}, {$inc: {point: STOREWEIGHT}}, (err)=>{});
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

                Book.update({_id: bookID}, {$inc: {point: -1 * STOREWEIGHT}}, (err)=>{});
                return handleSuccess({}, res);
            });
        });
    }
    static putStoredList(req, res) {
        const bookIDs = req.body.bookIDs;
        if(!bookIDs) {
            return handleError("non-valid input", res);
        }
        var newList = [];
        bookIDs.map((id) => {
            if (id.match(/^[0-9a-fA-F]{24}$/) && id.length == 24 ) {
                newList.indexOf(id) === -1 && newList.push(id);
            }
        });
        Auth.auth(req, (err, token) => {
            if(err) {
               return handleError(err, res);
            }
            User.update({_id: token._id}, {$set: {storedList: newList.slice(0, 8)}}, (err) => {
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
