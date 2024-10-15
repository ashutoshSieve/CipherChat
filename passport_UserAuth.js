require("dotenv").config();
const UserModel=require(__dirname+"/UserDataBase.js");
const passport=require("passport");
const LocalStrategy = require('passport-local');


passport.use("user-local",new LocalStrategy({ usernameField: 'email' }, function(email, password, done) {
    UserModel.findOne({email:email}).then((results) =>{
        if (!results) { return done(null, false, { message: 'Incorrect email or password.' }); }

        if (results.password !== password) {
            return done(null, false, { message: 'Incorrect email or password.' });
        }
        return done(null, results);
    }).catch((err) =>{
        if (err) { return done(err); }
    });

}));

// Serialize and deserialize user for session support
passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    UserModel.findById(id).then((results,err) =>{
        done(err, results);
    });
});
