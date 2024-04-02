const axios = require('axios');
const OpenAI = require('openai');
require('dotenv').config();
const express = require("express");
const mysql = require('mysql');
const bcrypt = require('bcrypt');
const session = require('express-session');
const { name } = require("ejs");
const app = express();
const pool = dbConnection();
let globalPlaylistId; 
let currentLoginId;
const searchGeniusSong = async (searchQuery) => {
  const options = {
    method: 'GET',
    url: 'https://genius-song-lyrics1.p.rapidapi.com/search/',
    params: {
      q: searchQuery,
      per_page: '10',
      page: '1'
    },
    headers: {
      'X-RapidAPI-Key': 'bfded6286fmshfdc4e1e94397a17p1955d0jsnaab4f69c4607',
      'X-RapidAPI-Host': 'genius-song-lyrics1.p.rapidapi.com'
    }
  };

  try {
    const response = await axios.request(options);
    const hits = response.data.hits;
    const matchingSong = hits.find((song) => song.result.title === searchQuery);

    if (matchingSong) {
      return {
        title: matchingSong.result.title,
        artist: matchingSong.result.artist_names,
        releaseDate: matchingSong.result.release_date_for_display,
      };
    } else {
      return null;
    }
  } catch (error) {
    console.error(error);
    return null;
  }
};
app.set('trust proxy', 1) // trust first proxy
app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: true }
}))

app.set("view engine", "ejs");
app.use(express.static("public"));

//to parse data using AJAX (post method)
app.use(express.json());

//to parse Form data sent using POST method
app.use(express.urlencoded({ extended: true }));


/////////routes////////

app.get('/', (req, res) => {
  res.render('login')
});
// app.get('/addSong', (req, res) => {
//   res.render('selectSongs')
// });

// app.post('/addSong', async (req, res) => {
//   const songName = req.body.songSearch;
//   // const songInfo = await searchGeniusSong(songName);
//   // console.log("songInfo")
//   // consolo.log(songsInfo)
//   // if (songInfo) {
//   //   // Render the 'selectsongs' EJS file with song information
//   //   res.render('selectsongs', { "songInfo": songInfo });
//   // } else {
//   //   res.send('No matching song found for the input title.');
//   // }
//   console.log(songName)
//   res.render('selectsongs')

// });

app.get('/addToMyPlaylist/:playlistId', isAuthenticated, async (req, res) => {
  const playlistId = req.params.playlistId;

  const sql = `SELECT name, image
               FROM q_playlists 
               WHERE playlistId = ?`;

  const playlistInfo = await executeSQL(sql, [playlistId]);

  if (playlistInfo.length > 0) {
    const { name, image } = playlistInfo[0];

    const insertSql = `INSERT INTO q_playlists (adminId, name, image) VALUES (?, ?, ?)`;
    const insertParams = [currentLoginId, name, image];

    await executeSQL(insertSql, insertParams);

    res.redirect('/myPlaylist');
  } else {
    res.status(404).send('Playlist not found');
  }
});

app.get('/songs/:playlistId', async (req, res) => {
  let playlistId = req.params.playlistId;

  let sql = `SELECT *
            FROM q_song
            NATURAL JOIN q_playlists
            WHERE playlistId = ?`;
  // let sql2 = `SELECT name
  //             FROM q_playlists
  //             WHERE playlistId = ?`;
  let songs = await executeSQL(sql, [playlistId]);
  // let playlistName = await executeSQL(sql2, [playlistId]);

  // console.log(playlistName);
  res.render('songs', { "songs": songs })
});


app.post('/login', async (req, res) => {
  let username = req.body.username;
  let password = req.body.password;

  let hashedPwd = "";

  let sql = `SELECT *
             FROM q_admin
             WHERE username = ?`;
  let rows = await executeSQL(sql, [username]);
  if (rows.length > 0) {  //username was found in the database
    hashedPwd = rows[0].password;
  }

  const match = await bcrypt.compare(password, hashedPwd);

  if (match) {
    req.session.authenticated = true;
    res.render("home");
  } else {
    res.render('login', { "errorMessage": "Wrong username/password!" });
  }
});


app.post('/api/login', async (req, res) => {
  let username = req.body.username;
  let password = req.body.password;

  let hashedPwd = "";

  let sql = `SELECT *
             FROM q_admin
             WHERE username = ?`;
  let rows = await executeSQL(sql, [username]);
  if (rows.length > 0) {  //username was found in the database
    hashedPwd = rows[0].password;
  }

  const match = await bcrypt.compare(password, hashedPwd);

  currentLoginId = rows[0].adminId;
  
  if (match) {
    req.session.authenticated = true;
    res.send({ "authenticated": true });
  } else {
    res.send({ "authenticated": false });
  }
});


app.get('/home', isAuthenticated, (req, res) => {

  let admin = 1
  let sql = `SELECT *
             FROM q_playlists
             WHERE adminId = ?`
  let rows = executeSQL(sql, [admin]);
  res.render('home', {"playlists":rows});
});


function isAuthenticated(req, res, next) {
  if (req.session.authenticated) {
    next();
  } else {
    res.render('login', { "errorMessage": "Need to log in!" });
  }
}

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.render('login', { "errorMessage": "Need to log in!" });
});


app.get('/communityPlaylist', async (req, res) => {

  let sql = `SELECT playlistId, name, image
              FROM q_playlists
              ORDER BY RAND()
              LIMIT 10`;

  let playlists = await executeSQL(sql);
  // console.log(playlists)
  res.render('CommunityPlaylist', { "playlists": playlists });
});

app.get('/create', async (req, res) => {

  let playlistName = req.query.playlistName;
     let sql = `SELECT *
                FROM q_song`;
  let songs = await executeSQL(sql);

  res.render('create', { "songs": songs })
});

// app.get('/create', async (req, res) => {

//   let playlistName = req.query.playlistName;
     

//   res.render('create')
// });


app.get('/selectSongs', async (req, res) => {
  const playlistId = req.query.playlistId;
  globalPlaylistId = playlistId;

  try {
    // Get distinct songs based on title
    let sql = `SELECT MAX(songId) as songId, title, MAX(artist) as artist, MAX(playlistId) as playlistId, MAX(genre) as genre
               FROM q_song
               GROUP BY title`;

    let songs = await executeSQL(sql);

    console.log(songs);
    res.render('selectSongs', {"songs": songs});
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/selectSongs', async (req, res) => {
  let playlistId = globalPlaylistId;
  let selectedSongsId = req.body.selectedSongs || [];
  let songsdetails = `SELECT * FROM q_song WHERE songId IN (?)`;
  let songs = await executeSQL(songsdetails, [selectedSongsId]);
  console.log(playlistId)
  console.log(songs)
  let sql = `INSERT INTO q_song (title, artist,playlistId, genre) VALUES ( ?, ?, ?, ?)`;
  for (const songDetail of songs) {
    let params = [ songDetail.title, songDetail.artist, playlistId, songDetail.genre];
    await executeSQL(sql, params);
  }
  res.render('create')
});

// OPEN AI API
const openAiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.post('/getImage', async (req, res) => {
  let songName = req.body.songSearch;

  try {
    const response = await openAiClient.images.generate({
      model: "dall-e-3",
      prompt: "a profound visualization of what a person who would listen to these songs would like as an albumb cover for these songs: " + songName,
      size: "1024x1024",
      quality: "standard",
      n: 1,
    });

    const imageUrl = response.data[0].url;
    res.json({ imageUrl: imageUrl });
  } catch (error) {
    console.error("Error generating image:", error);
    res.status(500).send("Error generating image");
  }
});

app.post('/create', async (req, res) => {
    const playlistName = req.body.playlistName;
  
      let sql = `INSERT INTO q_playlists
                      (adminId, name) 
                      VALUES
                      (?,?)`;
  let params = [currentLoginId, playlistName];

  let response = await executeSQL(sql, params);
  let sql2 = `SELECT playlistId
              FROM q_playlists  
              WHERE name = ?`;
  let playlistId = await executeSQL(sql2, [playlistName]);
  // this part need to be fix 
  // for this part we need to get the new playlist id and send it to the selectsongs route
  // if playlist id to the selectsong route then we can use that to add song to the database but with different playlist ids

  const finalPlaylistId = playlistId[0].playlistId;
  res.redirect(`/selectSongs?playlistId=${finalPlaylistId}`);
});

app.get('/myPlaylist', async (req, res) => {
  let admin = currentLoginId;
  let sql = `SELECT *
             FROM q_playlists
             WHERE adminId = ?`;
  let params = [admin];
  
  let playlists = await executeSQL(sql, params);
  console.log(playlists)

  res.render('myPlaylist',  { "playlists": playlists })
});

app.get('/deletePlaylist', async (req, res) => {
  let playlistId = req.query.playlistId;
  console.log(playlistId)
   let sql =  `DELETE
               FROM q_playlists
               WHERE playlistId = ?`;
  let rows = await executeSQL(sql,[playlistId])
   res.redirect('/myPlaylist')
});

app.get('/updatePlaylist', async (req, res) => {
   let id = req.query.playlistId;
   let sql = `SELECT *
              FROM q_playlists
              WHERE playlistId = ?`;
   let params = [id];
   let data = await executeSQL(sql, params);

  res.render('updatePlaylist', {"playlistInfo":data[0]})
});

//Song Artist API
// app.post('/create', async (req, res) => {
//   //console.log(req);

//   let playlistName = req.body.playlistName;
//   let genreSelected = req.body.genre;
//   let songName = req.body.songSearch;

//   const searchQuery = songName;
//   const options = {
//     method: 'GET',
//     url: 'https://genius-song-lyrics1.p.rapidapi.com/search/',
//     params: {
//       q: searchQuery,
//       per_page: '10',
//       page: '1'
//     },
//     headers: {
//       'X-RapidAPI-Key': process.env.GENIUS_API_KEY,
//       'X-RapidAPI-Host': 'genius-song-lyrics1.p.rapidapi.com'
//     }
//   };
//   axios.request(options)
//     .then(function(response) {
//       const hits = response.data.hits;
//       const matchingSong = hits.find(song => song.result.title === searchQuery);
//       if (matchingSong) {
//         console.log('Title:', matchingSong.result.title);
//         console.log('Artist:', matchingSong.result.artist_names);
//         console.log('Release Date:', matchingSong.result.release_date_for_display);
//         /*
//         console.log('Lyrics:', matchingSong.result.lyrics);
//         console.log('URL:', matchingSong.result.url);
//         console.log('Image:', matchingSong.result.song_art_image_thumbnail_url);
//         let sql = `INSERT INTO q_playlists 
//                    (name)
//                    VALUES (?)`
//         let params = [playlistName];
//         let response = await executeSQL(sql, params);

//         let songSql = `INSERT INTO q_song
//                        (title, artist, genre)
//                        VALUES (?,?,?)`
//         let songParams = [matchingSong.result.title, matchingSong.result.artist_names, genreSelected];
//         let songResponse = await executeSQL(songSql, songParams);
//         */

//       } else {
//         console.log('No matching song found for the input title.');
//       }
//     })
//     .catch(function(error) {
//       console.error(error);
//     });


//   // let sql = `INSERT INTO q_playlist
//   //            (playlistName)
//   //            VALUES (?)`; I 

//   // let params = [name];

//   // let response = await executeSQL(sql, params);


//   res.render('home')
// });


app.post('/updatePlaylist', async (req, res) => {

  let id = req.body.playlistId;
  let name = req.body.playlistName;
  let image = req.body.playlistImage;

  let sql = `UPDATE q_playlists
             SET name = ?,
                 image = ?
             WHERE playlistId = ?`;
  let params = [name, image, id];
  let data = await executeSQL(sql, params);
  
  res.redirect('/myPlaylist')
});

app.get('/mySongs/:playlistId', async (req, res) => {
  let playlistId = req.params.playlistId;

  let sql = `SELECT *
            FROM q_song
            NATURAL JOIN q_playlists
            WHERE playlistId = ?`;

  let songs = await executeSQL(sql, [playlistId]);

  res.render('mySongs', { "songs": songs })
});

app.get('/deleteSong', async (req, res) => {
  let songId = req.query.songId;
  console.log(songId)
   let sql =  `DELETE
               FROM q_song
               WHERE songId = ?`;
  let rows = await executeSQL(sql,[songId])
   res.redirect('/myPlaylist')
});

app.get('/updateSong', async (req, res) => {
   let id = req.query.songId;
   let sql = `SELECT *
              FROM q_song
              WHERE songId = ?`;
      
   let params = [id];
   let data = await executeSQL(sql, params);

   let playlistSql = `SELECT playlistId, name
                      FROM q_playlists`;
  
   let playlist = await executeSQL(playlistSql);  

  res.render('updateSong', {"songInfo":data[0], "playlist":playlist})
});

app.post('/updatesong', async (req, res) => {

  let playlistId = req.body.playlistId;
  let songId = req.body.songId;
  let title = req.body.songTitle;
  let artist = req.body.songArtist;
  let genre = req.body.songGenre;

  let sql = `UPDATE q_song
             SET title = ?,
                 artist = ?,
                 genre = ?,
                 playlistId= ?
             WHERE songId = ?`;

  let params = [title, artist, genre, playlistId, songId];
  let data = await executeSQL(sql, params);

  res.redirect('/myPlaylist')
});


app.get('/addSongs', async (req, res) => { 
  
  res.render('addSongs')
});

app.post('/addSongs', async (req, res) => { 
   console.log("test")
  let name = req.body.songSearch;
  let genre = req.body.songGenre;
  
  const songInfo = await searchGeniusSong(name);
  
  let title = songInfo.title;
  let artist = songInfo.artist;
  console.log(title)
  console.log(artist)
  let sql = `INSERT INTO q_song
             (title, artist, genre)
             VALUES (?,?,?)`;
  let params = [title, artist, genre];
  let songs = await executeSQL(sql, params);
  
  res.redirect('/create')
});


app.get("/dbTest", async function(req, res) {
  let sql = "SELECT CURDATE()";
  let rows = await executeSQL(sql);
  res.send(rows);
});//dbTest

//functions
async function executeSQL(sql, params) {
  return new Promise(function(resolve, reject) {
    pool.query(sql, params, function(err, rows, fields) {
      if (err) throw err;
      resolve(rows);
    });
  });
}//executeSQL
//values in red must be updated
function dbConnection() {

  const pool = mysql.createPool({

    connectionLimit: 10,
    host: "l0ebsc9jituxzmts.cbetxkdyhwsb.us-east-1.rds.amazonaws.com",
    user: "buyb187yan9alssd",
    password: "ugi699509hd99mez",
    database: "whdpbr1wq19za9zv"

  });

  return pool;

 

} //dbConnection

//start server
app.listen(3000, () => {
  console.log("Expresss server running...")

})













