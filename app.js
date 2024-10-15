require("dotenv").config();
const http=require("http");
const express=require("express");
const bodyParser=require("body-parser");
const ejs=require("ejs");
const session=require("express-session");
const MongoStore=require("connect-mongo");
const User=require(__dirname+"/UserDataBase.js");
const Comm=require(__dirname+"/ComDataBase.js");
const passport=require("passport");
const {Server}=require("socket.io");
const { Socket } = require("dgram");
const app=express();
const server=http.createServer(app);
const io=new Server(server);

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended:true}));

const FpageSocket=io.of("/F");
FpageSocket.on("connection", (socket) =>{
    
    socket.on("newPost", (newPost, id) => {
        User.findOne({_id:id}).then((result) => {
            if(result){
                result.HPost=newPost;
                result.save();
            }else{
                console.log("there is an error !!");
            }
        }).catch((err) => {
            console.log(err);
        });
        FpageSocket.emit("posted", { post: newPost, id }); 
    });    

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
    });
});

const CommSocket = io.of("/C");
CommSocket.on("connection", (socket) => {
    
    socket.on("newPost", (newPost, user, name) => {
        Comm.findOne({ name: name }).then((result) => {
            if (result) {
                const userInPosts = result.posts.find(post => post.name === user);
                if (userInPosts) {
                    userInPosts.post = newPost;
                    result.save();
                } else {
                    console.log("User not found in posts for community:", name);
                }
            } else {
                console.log("Community not found:", name);
            }
        }).catch((err) => {
            console.log("Error finding community:", err);
        });

        // Emit to the namespace
        CommSocket.emit("posted", { post: newPost, user });
    });

    socket.on("disconnect", () => {
        console.log("User disconnected from CommSocket:", socket.id);
    });
});

app.set('trust proxy', 1) 
app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({mongoUrl: process.env.URL, collectionName: "session"}),
    cookie: {
        maxAge:1000*60*60*24
    }
}));

require(__dirname+"/passport_UserAuth.js");
app.use(passport.initialize());
app.use(passport.session());


app.get("/", function(req,res){
    res.render("home");
});

app.get("/login",function(req,res){
    res.render("login");
});

app.get("/signup",function(req,res){
    res.render("signup");
});

app.get("/logout", function(req,res){
    req.logout(function(err){
        if(err){return next(err);}
        res.redirect("/");
    });
});

app.get("/Fpage", function(req,res){

    if(req.isAuthenticated()){
        User.find({"HPost":{$ne:null}}).then((result) => {
            const data = result.map(user => user.HPost);
            const id=req.user._id;
            res.render("Fpage", { Users: req.user.name, data, id });
        }).catch((err) => {
            console.log(err);
            res.redirect("/");
        });
    }else{
        res.redirect("/login");
    }
});

app.get("/communites", function(req,res){
    if(req.isAuthenticated()){
        Comm.find({"name":{$ne:null}}).then((result) => {
            const data = result.map(user => user.name);
            res.render("community", { data });
        }).catch((err) => {
            console.log(err);
        });

    }else{
        res.redirect("/");
    }
});

app.get("/SingleCom/:topic", function(req,res){
    Comm.findOne({name:req.params.topic}).then((result) => {
        if(result){
            const data = result.posts.filter(post => post.post !== null && post.post !== "");
            // Pass the filtered data to the template, if necessary
            res.render("SingleCom", { name: req.params.topic, result: data, user:req.user.name});
        }else{
            console.log("Error !!");
            res.redirect("/communites");
        }
    }).catch((err) => {
        console.log(err);
        res.redirect("/communites");
    });
});

app.get("/readmore/:title/:user", function(req,res){
    if(req.params.title==="Global"){
        User.findOne({_id:req.params.user}).then((result) => {
            if(result){
                res.render("readSinglePage",{title:"Global", message:result.HPost});
            }else{
                console.log("Internal Server Error !!");
            }
        }).catch((err) => {
            console.log(err);
        });
    }else{
        Comm.findOne({name:req.params.title}).then((result) => {
            if(result){
                const msg=result.posts.find(post=>post._id==req.params.user);
                if(msg){
                    res.render("readSinglePage",{ title:req.params.title, message: msg.post });
                }else{
                    console.log("server error !!");
                }
            }else{
                console.log("internal Server error !!");
            }
        }).catch((err) => {
            console.log(err);
        });
    }
});

app.post("/user/signup", function(req,res){
    User.findOne({email:req.body.email}).then((result) => {
        if(result){
            console.log("User already Exist !!");
            return res.redirect("/");
        }else{
            const newUser=new User({
                name:req.body.name,
                email:req.body.email,
                password:req.body.password
            });

            newUser.save().then(() => {
                // Log in the user immediately after signup
                req.login(newUser, (err) => {
                    if (err) {
                        console.log(err);
                        return res.redirect("/"); // Handle the error appropriately
                    }
                    res.redirect("/Fpage");
                });
            }).catch(err => console.log(err));
        }
    }).catch((err) => {
        console.log(err);
    });
});

app.post("/login", function(req,res,next){
    if (req.body.type === "user") {
        // Authenticate using user strategy
        passport.authenticate("user-local", {
            successRedirect: "/Fpage",
            failureRedirect: "/"
        })(req, res, next); 
    } else if (req.body.type === "comm") {
        // Authenticate using community strategy
        Comm.findOne({name:req.body.name}).then((result) => {
            if(result){
                if(result.pass===req.body.pass){
                    const userInPosts = result.posts.find(post => post.name === req.user.name);

                    if (!userInPosts) {
                        // Add the user to the posts array if not present
                        result.posts.push({ name: req.user.name});
                        result.save();
                    }
                    // Redirect to the SingleCom page
                    res.redirect(`/SingleCom/${req.body.name}`);
                }else{
                    console.log("Invalid Credential !!");
                    res.redirect("/communites");
                }
            }else{
                console.log("Invalid Credential !!");
                res.redirect("/communites");
            }
        }).catch((err) => {
            console.log(err);
            res.redirect("/communites");
        });
        
    } else {
        res.redirect('/');
    }
});

app.post("/com/signup", function(req,res){
    Comm.findOne({name:req.body.name}).then((result) => {
        if(result){
            console.log("name already exist !!");
            res.redirect("/communites");
        }else{
            const newCom=new Comm({
                name:req.body.name,
                pass:req.body.pass,
                posts:[
                    {
                        name:req.user.name
                    }
                ]
            });
            newCom.save().then(() =>{ 
                res.redirect(`/SingleCom/${req.body.name}`);
            }).catch((err) =>{
                console.log(err);
                res.redirect("/communites");
            });
        }
    }).catch((err) => {
        console.log(err);
        res.redirect("/communites");
    });
});

app.post("/search", function(req,res){
    Comm.findOne({name:req.body.txt}).then((result) => {
        if(result){
            res.render("seprateLoginCom",{name:req.body.txt});
        }else{
            console.log("Not Exist the Community !!");
            res.redirect("/communites");
        }
    }).catch((err) => {
        console.log(err);
        res.redirect("/communites");
    });
});

server.listen(process.env.PORT, function(){
    console.log("server is running on port 3000 !!");
});