const	express = require('express'),
		bodyParser = require("body-parser"),
		controller = require('./app/controllers/controller'),
		fs = require('fs'),
		http = require('http'),
		https = require('https');		
	
const app = express();
app.set('views', __dirname + '/app/views');
app.set('view engine', 'pug');
app.use(express.static(__dirname + '/app', { dotfiles: 'allow' }));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get('/', function(req, res){
	res.render('ccss', {
		calendarEvents : JSON.stringify(controller.getEvents())
	});
});

app.get('/Attendance', function(req, res){
	res.render('attendance', {
		date : req.query.date,
		covers : controller.deriveCovers(req.query.date)
	});
});

app.get('/UpdateAvailability', function(req, res){
	res.render('updateavailability', {
		date : req.query.date,
		year : req.query.year,
		subject : req.query.subject,
		teachers : controller.getTeachers(),
		cover : controller.deriveCover(req.query.date, req.query.year, req.query.subject)
	});
});

app.post('/server',function(req, res){
	console.log('here');
	const data = req.body;
	if(controller.saveCover(data) == true) {
		res.json({success : 'Updated Successfully', status : 200});
	} else {
		res.json({status : 404});
	}
});

app.use(function(req, res, next) {
  return res.status(404).send('Sorry cant find that page! Or encountered an error! Please raise to management');
});

const privateKey = fs.readFileSync('/etc/letsencrypt/live/ccss.cf/privkey.pem', 'utf8');
const certificate = fs.readFileSync('/etc/letsencrypt/live/ccss.cf/cert.pem', 'utf8');
const ca = fs.readFileSync('/etc/letsencrypt/live/ccss.cf/chain.pem', 'utf8');
const credentials = {
	key: privateKey,
	cert: certificate,
	ca: ca
};

// Starting both http & https servers
const httpServer = http.createServer(app);
const httpsServer = https.createServer(credentials, app);

httpServer.listen(process.env.PORT || 3000, () => {
	console.log('HTTP Server running on port 8080');
});

httpsServer.listen(8443, () => {
	console.log('HTTPS Server running on port 8443');
});
