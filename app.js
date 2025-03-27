require("dotenv").config();
const express=require("express");
const ejs=require("ejs");
const bodyParser=require("body-parser");
const User=require("./UserDataBase");
const cookieParser=require("cookie-parser");
const {jsonwebtoken,generateJWT}=require("./JWT");
const Community=require("./CommunityDataBase");
const http=require("http");
const {Server}=require("socket.io");
const passport=require("passport");
const app=express();
const server=http.createServer(app);
const io=new Server(server);

require("./GoogleAuth");

app.set("view engine", "ejs");
app.use(cookieParser());
app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static("public"));
app.use(passport.initialize());


app.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email']
}));


app.get('/auth/callback', 
    passport.authenticate('google', { session: false, failureRedirect: '/login' }),
    (req, res) => {
        const user = req.user;
        
        const token = generateJWT({ id: user._id, name: user.name, email: user.email });

        res.cookie('token', token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
        res.redirect('/main'); // Redirect to your desired route
    }
);


const mainPageSocket=io.of("/main");
mainPageSocket.on("connection", (socket) =>{

    socket.on("newPost", (message,id) =>{
        User.findById(id).then((result) => {
            if(result){
                result.post=message;
                result.save();
            }else{
                console.log("Internal Server Error !!");
            }
        }).catch((err) => {
            console.log(err);
        });
        mainPageSocket.emit("Posted", {message, id })
    });

    socket.on("disconnect", () =>{
        console.log("User Got Dissconnected !!", socket.id);
    });
});

const CommunitySocket = io.of("/community");
CommunitySocket.on("connection", (socket) => {
    socket.on("newPost", (name, user, message) => {
        Community.findOne({ name: name }).then((result) => {
            if (result) {
                const postIndex = result.posts.findIndex(post => post.id === user);

                if (postIndex !== -1) {
                    result.posts[postIndex].post = message;
                } else {
                    result.posts.push({ id: user, post: message });
                }

                // Save the changes
                result.save().then(() => {
                    CommunitySocket.emit("Posted", { name, user, message });
                }).catch((err) => {
                    console.log("Error saving updated or new post: ", err);
                });
            } else {
                console.log("Community not found.");
            }
        }).catch((err) => {
            console.log("Error finding community: ", err);
        });
    });

    socket.on("disconnect", () => {
        console.log("User got disconnected: ", socket.id);
    });
});


app.get("/", function(req,res){
    res.render("home");
});
app.get("/signup", function(req,res){
    res.render("Signup");
});
app.get("/login", function(req,res){
    res.render("Login");
});

app.get("/main", jsonwebtoken, async function(req, res) {
    try {
        const usersWithPosts = await User.find({ post: { $ne: null } }, 'post id').exec();
        const data = usersWithPosts.map(user => ({
            post: user.post,
            id: user.id
        }));
        const user = req.payload.name;
        const id = req.payload.id;
        res.render("mainPage", { data, user, id });
    } catch (err) {
        console.error("Error retrieving posts:", err);
        res.redirect("/");
    }
});

app.get("/ReadFull/:topic", function(req, res) {
    User.findById(req.params.topic)
        .then(userPost => {
            if (!userPost) {
                console.log("Post not found. Redirecting to main page.");
                return res.redirect("/main");
            }
            res.render("FullPageRead", { message: userPost.post });
        })
        .catch(err => {
            console.log("Internal Server Error:", err);
            res.redirect("/main");
        });
});

app.get("/ReadSingle/:User/:Name", function(req, res) {
    Community.findOne({ name: req.params.Name })
        .then((result) => {
            if (!result) {
                console.log("Community not found. Redirecting to main page.");
                return res.redirect("/main");
            }

            const data = result.posts.find(post => post.id === req.params.User);
            
            if (!data) {
                console.log("Post not found. Redirecting to main page.");
                return res.redirect("/main");
            }
            res.render("FullPageRead", { message: data.post });
        })
        .catch((err) => {
            console.log("Internal Server Error:", err);
            res.redirect("/main");
        });
});

app.get("/Community", jsonwebtoken, function(req,res){
    Community.find({"name":{$ne:null}}).then((result) => {
        const data=result.map(sol => ({
            name:sol.name,
            id:sol.id
        }));

        const user=req.payload.name;
        res.render("Community", {data, user});
    }).catch((err) => {
        console.log(err);
        res.redirect("/main");
    });
});



app.post("/signup", function(req,res){
    User.findOne({email:req.body.email}).then((result) => {
        if(result){
            console.log("User Already Exist !!");
            res.redirect("/signup");
        }else{
            const newUser=new User({
                name:req.body.name,
                email:req.body.email,
                password:req.body.password
            });

            newUser.save()
                .then(() => {
                    const payload = {
                        id: newUser.id,
                        email: newUser.email,
                        name: newUser.name
                    };
                    const token = generateJWT(payload);
                    res.cookie('token', token, { httpOnly: true, path: '/'}); // Using a cookie
                    res.redirect("/main"); // Redirect after setting the cookie
                })
                .catch((error) => {
                    console.error('Error saving user:', error);
                    res.redirect("/signup");
                });
        }
    }).catch((err) => {
        console.log(err);
        res.redirect("/signup");
    });
});

app.post("/login", function(req,res){
    User.findOne({email:req.body.email}).then((result) => {
        if(result){
            if(result.password === req.body.password){
                const paylod={
                    id:result.id,
                    email:result.email,
                    name:result.name
                };
                const token=generateJWT(paylod);
                res.cookie('token', token, { httpOnly: true,path: '/'}); 
                res.redirect("/main");
            }else{
                console.log("Invalid Credentials !!");
                res.redirect("/login");
            }
        }else{
            console.log("Invalid Credentials !!");
            res.redirect("/login");
        }
    }).catch((err) => {
        console.log(err);
        res.redirect("/login");
    });
});

app.post("/CreateComm", jsonwebtoken, function(req,res){
    Community.findOne({name:req.body.name}).then((result) => {
        if(result){
            console.log("Community already exist!!");
            res.redirect("/Community");
        }else{
            const userEntery={
                id:req.payload.id,
                post:""
            };

            const newCom=new Community({
                name:req.body.name,
                pass:req.body.pass,
                posts:[userEntery]
            });
            
            newCom.save().then(() => {
                Community.findOne({ name: req.body.name }).then((community) => {
                    // Filter out posts that are not null or empty
                    const data = community.posts.filter(post => post);
                    const name = req.body.name;
                    const id=req.payload.id;
                    res.render("SingleCommunity", { data, name, id });
                }).catch((err) => {
                    console.log(err);
                    res.redirect("/Community");
                });
            }).catch((err) => {
                console.log(err);
                res.redirect("/Community");
            });
        }
    }).catch((err) => {
        console.log(err);
        res.redirect("/Community");
    });
});

app.post("/EnterComm", jsonwebtoken, function(req, res) {
    const id = req.payload.id;

    Community.findOne({ name: req.body.name }).then((result) => {
        if (result) {
            if (req.body.pass === result.pass) {
                const name = req.body.name;
                const isUserEnrolled = result.posts.some(post => post.id === id);

                if (!isUserEnrolled) {
                    result.posts.push({ id: id, post: "" });
                    result.save().then(() => {
                        console.log("User enrolled in the community successfully.");
                    }).catch(err => {
                        console.log("Error enrolling user: ", err);
                    });
                }

                const data = result.posts.filter(post => post.post);
                res.render("SingleCommunity", { data, name, id});
            } else {
                console.log("Credentials invalid!!");
                res.redirect("/Community");
            }
        } else {
            console.log("Community does not exist!!");
            res.redirect("/Community");
        }
    }).catch((err) => {
        console.log(err);
        res.redirect("/Community");
    });
});

app.post("/Search", function(req,res){
    Community.findOne({name:req.body.name}).then((result) => {
        if(result){
            res.render("SearchCommunity", {name: req.body.name});
        }else{
            console.log("Internal Server Error !!");
            res.redirect("/Community");
        }
    }).catch((err) => {
        console.log(err);
        res.redirect("/Community");
    });
});


server.listen(process.env.PORT, function(){
    console.log("server is running on port 3000 !!");
})
