var mongoose = require('mongoose');

var imageSchema = new mongoose.Schema({
    data: {type: Buffer},
    createTime: {type: Date, default: Date.now}
}, {
    timestamps: { createdAt: 'createTime'}
});

module.exports = mongoose.model('ImageModel', inageSchema);
