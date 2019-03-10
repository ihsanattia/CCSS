const config = require('./../config/config.json'),
	  fs = require('fs'),
	  aws = require('aws-sdk');
	
const s3 = new aws.S3({ accessKeyId: config.s3.awsId, secretAccessKey: config.s3.awsSecretKey });

var schoolDates, defaultCovers,	savedCovers, teachers;
getAllStaticData();

async function getAllStaticData() {
	schoolDates = await getStaticData('dates');
	defaultCovers = await getStaticData('defaultCover');
	savedCovers = await getStaticData('covers');
	teachers = await getStaticData('teachers');
}

async function getStaticData(dataset) {
	try {	
		var getParams = {
			Bucket: config.s3.bucket,
			Key: config.s3.env + '/' + dataset + '.json'
		}

		let data = await s3.getObject(getParams).promise();
		
		console.log('S3 GetObject for ' + dataset + '.json Static Data Success');

		return JSON.parse(data.Body.toString());
	} catch(error) {
		console.log('S3 GetObject for ' + dataset + '.json Static Data Failed');
		console.log(error);		
	}
}

function getEvents() {
	var events = [];
	for(var i=0; i<schoolDates.dates.length; i++) {
		var eventData;
		if(schoolDates.dates[i].type === 'cover') {
			eventData = 
			{
				title: 'View Cover',
				url: '/Attendance?date='+schoolDates.dates[i].date,
				start: formatDate(new Date(schoolDates.dates[i].date)),
				backgroundColor: '#4C8472'
			};
		}
		if(schoolDates.dates[i].type === 'break') {
			eventData = 
			{
				title: schoolDates.dates[i].text,
				start: formatDate(new Date(schoolDates.dates[i].date)),
				backgroundColor: '#f2f2f2'
			};
		}
		
		if(eventData) {
			events.push(eventData);
		}
	}
	return events;
}

function getTeachers() {
	return teachers.teachers.sort(function(a, b) { 
			return a.name.toUpperCase() > b.name.toUpperCase() ? 1 : a.name.toUpperCase() < b.name.toUpperCase() ? -1 : 0;
		});
}

function formatDate(date) {
	var d = new Date(date);
	var day = ("0" + d.getDate()).slice(-2);
	var month = ("0" + (d.getMonth() + 1)).slice(-2);
	var year = d.getFullYear();

	return year + '-' + month + '-' + day;
}

function formatDateDisplay(date) {
	var d = new Date(date);
	var monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

	var day = d.getDate();
	var monthIndex = d.getMonth();
	var year = d.getFullYear();

	return day + ' ' + monthNames[monthIndex] + ' ' + year;
}

function deriveCovers(date) {
	var formattedDate = formatDate(date);
	var covers = []
	
	for(var i=0; i<defaultCovers.defaults.length; i++) {
		
		var defaultCover = defaultCovers.defaults[i];
		var cover = savedCovers.covers.find(c => c.date === formattedDate && c.year === defaultCover.year && c.subject === defaultCover.subject);

		if(cover) {
			covers.push(cover);
		} else {
			cover = 
			{
				date : formattedDate,
				year : defaultCover.year,
				subject : defaultCover.subject,
				teachers : [{name : defaultCover.teacher}]
			}
			covers.push(cover);
		}
		
	}
	
	return covers;
}

function deriveCover(date, year, subject) {
	var formattedDate = formatDate(date);
	var covers;
	
	var cover = savedCovers.covers.find(c => c.date === formattedDate && c.year === year && c.subject === subject);

	if(cover) {
		return cover.teachers;
	} else {
		var defaultCover = defaultCovers.defaults.find(d => d.year === year && d.subject === subject);
		if(defaultCover) {
			return [{name : defaultCover.teacher}];
		}
	}
	
	return;
}

function saveCover(data) {
	var success = false;
	try {
		var date = formatDate(data.date);
		var year = data.year;
		var subject = data.subject;
		var teachers = data.teachers;
		data.date = date;
		
		var cover = savedCovers.covers.find(c => c.date === date && c.year === year && c.subject === subject);
		var defaultCover = defaultCovers.defaults.find(d => d.year === year && d.subject === subject);
		
		var requireSave = true;
		
		if(cover) {
			if(cover.teachers.length == teachers.length) {
				var same = true;
				for(var i=0; i<teachers.length; i++) {
					if(!cover.teachers.find(t => t.name === teachers[i].name)) {
						same = false;
					}
				}
				if(same === true) {
					requireSave = false;
				}
			}
		} else if (defaultCover) {
			if(teachers && teachers.length == 1 && teachers[0].name === defaultCover.teacher){
				requireSave = false;
			}
		}
		
		if(requireSave === true) {
			if(cover) {
				var index = savedCovers.covers.indexOf(cover);
				savedCovers.covers.splice(index, 1);
			}
			
			if(defaultCover && teachers && teachers.length == 1 && teachers[0].name === defaultCover.teacher) {
			} else {
				savedCovers.covers.push(data);
			}
			
			console.log("Covers updated for " + date + " year " + year + " " + subject);
			console.log(data);

			var putParams = {
				Body: JSON.stringify(savedCovers),
				ServerSideEncryption: 'AES256',
				Bucket: config.s3.bucket,
				Key: config.s3.env + '/covers.json'
			};
			var putObjectPromise = s3.putObject(putParams).promise();
			putObjectPromise.then(function(data) {
				console.log('S3 PutObject Call Success');
			}).catch(function(error) {
				console.log('S3 PutObject Call Failed');
				console.log(error);
			});

		}
		success = true;
	}
	catch (error) {
		console.log(error);
		success = false;
	}
	finally {
		return success;
	}
}

exports.getEvents = getEvents;
exports.deriveCovers = deriveCovers;
exports.deriveCover = deriveCover;
exports.saveCover = saveCover;
exports.getTeachers = getTeachers;
exports.formatDateDisplay = formatDateDisplay;
