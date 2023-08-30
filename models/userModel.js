const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please tell us your name']
    },
    email: {
        type: String,
        required: [true, 'Please provide your email'],
        unique: true,
        lowerCase: true,
        validate: [validator.isEmail, 'Please provide a valid email']
    },
    photo: String,
    role: {
        type: String,
        enum: ['user', 'guide', 'lead-guide', 'admin'],
        default: 'user'
    },
    password: {
        type: String,
        required: [true, 'Please provide a password'],
        minLength: 8,
        select: false //to avoid appearing in get requests
    },
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    passwordConfirm: {
        type: String,
        required: [true, 'Please provide your password'],
        
        //This only works on CREATE & SAVE, not on Update or find
        //so we need to use .save() here not .findOneAndUpdate() like we did on tours
        validate: {
            validator: function(el) {
                return el === this.password;
            },
        message: 'Passwords are not the same'
        }
    },
    active: {
        type: Boolean,
        default: true,
        select: false
    }
});

//runs and manipulates data between receiving data and saving it to database
userSchema.pre('save', async function(next){
    //only run this function if password field was actually modified or created not email or anything like that
    if (!this.isModified('password')) return next();

    //hash password with cost of 12
    this.password = await bcrypt.hash(this.password, 12);
    
    //we dont need confirm pass field as we have the real password hashed....this is only for validation for creating document after the !this.isModified('password') check
    this.passwordConfirm = undefined;
});

//runs before we save each document
userSchema.pre('save', function(next){
    
    //if the doc is not modified or if the doc is new no manipulation needed
    if (!this.isModified('password') || this.isNew) return next();

    //sometime saving to db is slower than the issue of JSON web token, making its timestamp after than the JSON token so we -1 sec from this timestamp bcz of comparison with JSON WEB TOKEN later on
    this.passwordChangedAt = Date.now() - 1000;
    next();
})

//QUERY MIDDLEWARE 
// /^find/ tells all words which start with find
userSchema.pre(/^find/, function(next){
    //this points to current query
    //find all documents where active is not equal to false (is true);
    // use $ne if active: true shows no documents due to some documents created before not having active property
    this.find({ active: { $ne: false } });
    next();
})

//instance method, available for all documents of a collection

userSchema.methods.correctPassword = async function(candidatePassword, userPassword){
    return await bcrypt.compare(candidatePassword, userPassword);
}

//this points to current document
userSchema.methods.changedPasswordAfter = function(JWTTimeStamp) {
    
    if(this.passwordChangedAt){
        const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
        return JWTTimeStamp < changedTimestamp; // 100 < 200 returns true
    }

    //False means password not changed
    return false;
}

userSchema.methods.createPasswordResetToken = function(){
    const resetToken = crypto.randomBytes(32).toString('hex');
    this.passwordResetToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');
    
    this.passwordResetExpires = Date.now() + 10 * 60 * 1000;
    return resetToken;
}

const User = mongoose.model('User', userSchema);

module.exports = User;