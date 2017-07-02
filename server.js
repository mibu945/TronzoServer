import mongoose from 'mongoose';
import express from 'express';
import bodyParser from 'body-parser';
import multipart from 'connect-multiparty';
import schedule from 'node-schedule';
const app = express();

//api
import UserAPI from './api/userAPI';
import BookAPI from './api/bookAPI'; 
import Auth from './api/auth';
import ImageAPI from './api/imageAPI';
import PostAPI from './api/postAPI';

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

//Auth Router
app.post('/get/userToken', Auth.login);
app.post('/loginByFB', Auth.loginByFB);

//User Router
app.get('/get/me', UserAPI.getMe);
app.get('/get/userByID', UserAPI.getUserByID);
app.post('/post/user', UserAPI.postUser);
app.post('/put/user', UserAPI.putUser);
app.post('/put/userProfilePic', UserAPI.putUserProfilePic);
app.post('/put/followUser', UserAPI.putFollowUser);
app.post('/put/cancelFollowUser', UserAPI.putCancelFollowUser);

//Book Router
app.get('/get/historicalBooks', BookAPI.getHistoricalBooks);
app.get('/get/storedListBooks', BookAPI.getStoredListBooks);

app.get('/get/storedBooks', BookAPI.getAllStoredBooks); // unuse
app.get('/get/AllStoredBooks', BookAPI.getAllStoredBooks);
app.get('/get/interestedBooks', BookAPI.getInterestedBooks);
app.get('/get/interestedBooksAndPosts', BookAPI.getFollowEntries); //unuse
app.get('/get/followEntries', BookAPI.getFollowEntries); 

app.get('/get/recommendedBooks', BookAPI.getRecommendedBooks);
app.get('/get/recommendedEntries', BookAPI.getRecommendedEntries);
app.get('/get/booksDefault', BookAPI.getBooksDefault);
app.get('/get/booksByTitle', BookAPI.getBooksByTitle);
app.get('/get/booksByUser', BookAPI.getBooksByUser);
app.get('/get/booksAndPostsByUser', BookAPI.getEntriesByUser); //unuse
app.get('/get/entriesByUser', BookAPI.getEntriesByUser); //unuse
app.get('/get/bookByID', BookAPI.getBookByID);
app.get('/get/bookSection', BookAPI.getBookSection);
app.get('/get/bookComments', BookAPI.getBookComments);
app.post('/post/book', BookAPI.postBook);
app.post('/post/bookComment', BookAPI.postBookComment);
app.post('/post/bookSection', BookAPI.postBookSection);
app.post('/put/book', BookAPI.putBook);
app.post('/put/bookSection', BookAPI.putBookSection);
app.post('/put/likeBook', BookAPI.putLikeBook);
app.post('/put/cancelLikeBook', BookAPI.putCancelLikeBook);
app.post('/put/storeBook', BookAPI.putStoreBook);
app.post('/put/cancelStoreBook', BookAPI.putCancelStoreBook);
app.post('/put/storedList', BookAPI.putStoredList);
app.post('/put/shareBook', BookAPI.putShareBook);
app.post('/delete/book', BookAPI.deleteBook);
app.post('/delete/bookSection', BookAPI.deleteBookSection);
app.post('/delete/bookComment', BookAPI.deleteBookComment);
//Image router
app.get('/get/image', ImageAPI.getImage);

//Post router
app.get('/get/postByID', PostAPI.getPostByID);
app.get('/get/postsByUser', PostAPI.getPostsByUser);
app.post('/post/post', PostAPI.postPost);
app.post('/put/post', PostAPI.putPost);
app.post('/post/postComment', PostAPI.postPostComment);
app.post('/put/likePost', PostAPI.putLikePost);
app.post('/put/cancelLikePost', PostAPI.putCancelLikePost);
app.post('/put/sharePost', PostAPI.putSharePost);
app.post('/delete/post', PostAPI.deletePost);
app.post('/delete/postComment', PostAPI.deletePostComment);
app.listen(app.get('port'), () => {
  console.log(`Find the server at: http://localhost:${app.get('port')}/`); // eslint-disable-line no-console
});

//run at 0:0:0 every sunday
schedule.scheduleJob("0 0 0 * * 0", () => {
    PostAPI.resetPoint();
    BookAPI.resetPoint();
});
