var mongoose = require('mongoose');

var postSchema = new mongoose.Schema({
    userID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserModel'
    },
    content: {type: String, require: true},
// meta
    createTime: {type: Date, default: Date.now},
    updateTime: {type: Date, default: Date.now}
}, {
    timestamps: { createdAt: 'createTime', updatedAt: 'updateTime' }
});

module.exports = mongoose.model('PostModel', postSchema);
