const mongoose = require('mongoose');
const Schema = mongoose.Schema;
 
const ContactSchema = new Schema({
    username:{ type:String ,uppercase:true},
    useremail:{ type:String},
    message: { type: String },
});
 
const Contact = mongoose.model('Contact',ContactSchema);
 
module.exports = Contact;
