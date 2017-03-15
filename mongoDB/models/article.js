var mongoose = require('mongoose');

var articleSchema = new mongoose.Schema({

    title: {type: String, require: true},
    content: {type: Buffer},
// meta
    createTime: {type: Date, default: Date.now},
    updateTime: {type: Date, default: Date.now},
}, {
    timestamps: { createdAt: 'createTime', updatedAt: 'updateTime' }
});

module.exports = mongoose.model('ArticleModel', articleSchema);
