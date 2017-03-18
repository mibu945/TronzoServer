import mongoose from 'mongoose';
import express from 'express';
import bodyParser from 'body-parser';
import multipart from 'connect-multiparty';
const app = express();

//mongodb models
import User from './mongoDB/models/user';
import Book from './mongoDB/models/book';
import Article from './mongoDB/models/article';

//api
import UserAPI from './api/userAPI';
import BookAPI from './api/bookAPI'; 
import Auth from './api/auth';
mongoose.Promise = global.Promise;
mongoose.connect('localhost');
mongoose.connection
    .on('error', () => {
        console.info('Error: Could not connect to MongoDB. Did you forget to run `mongod`?');
    })
    .once('open', () => {
        console.log('mongoose opened!');
    });

app.set('port', (process.env.PORT || 3000));
// Express only serves static assets in production
//if (process.env.NODE_ENV === 'production') {
//    app.use(express.static('client/build'));
//}

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(multipart());


app.all('*', function(req, res, next) {
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
      next();
});

app.get('/', (req, res) => {
    res.send("Hi!");
});


app.post('/get/userToken', Auth.login);
//User Router
app.get('/get/userByAccount', UserAPI.getUserByAccount);
app.get('/get/userByID', UserAPI.getUserByID);
app.post('/post/user', UserAPI.postUser);
app.post('/put/user', UserAPI.putUser);
app.post('/put/followUser', UserAPI.putFollowUser);
app.post('/put/cancelFollowUser', UserAPI.putCancelFollowUser);
app.post('/put/collectBook', UserAPI.putCollectBook);
app.post('/put/cancelCollectBook', UserAPI.putCancelCollectBook);

//Book Router
app.get('/get/booksDefault', BookAPI.getBooksDefault);
app.get('/get/booksByTitle', BookAPI.getBooksByTitle);
app.get('/get/booksByUser', BookAPI.getBooksByUser);
app.get('/get/book', BookAPI.getBook);
app.get('/get/bookSection', BookAPI.getBookSection);
app.post('/post/book', BookAPI.postBook);
app.post('/post/bookComment', BookAPI.postBookComment);
app.post('/post/bookSection', BookAPI.postBookSection);
app.post('/put/book', BookAPI.putBook);
app.post('/put/bookSection', BookAPI.putBookSection);
app.post('/delete/book', BookAPI.deleteBook);
app.post('/delete/bookSection', BookAPI.deleteBookSection);
//app.post('/post/image', BookAPI.postImage);

app.listen(app.get('port'), () => {
  console.log(`Find the server at: http://localhost:${app.get('port')}/`); // eslint-disable-line no-console
});
