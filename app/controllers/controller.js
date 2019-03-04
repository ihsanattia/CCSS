const config = require('./../config/config.json'),
	  fs = require('fs'),
	  aws = require('aws-sdk');
	
const s3 = new aws.S3({ accessKeyId: config.s3.awsId, secretAccessKey: config.s3.awsSecretKey });

var schoolDates, defaultCovers, savedCovers, teachers;

var getParams = {
	Bucket: config.s3.bucket,
	Key: config.s3.env + '/dates.json'
}	
s3.getObject(getParams, function (err, data) {
	if (err) {
		console.log(err);
	} else {
		 schoolDates = JSON.parse(data.Body.toString());
	}
})

getParams = {
	Bucket: config.s3.bucket,
	Key: config.s3.env + '/defaultCover.json'
}	
s3.getObject(getParams, function (err, data) {
	if (err) {
		console.log(err);
	} else {
		 defaultCovers = JSON.parse(data.Body.toString());
	}
})

getParams = {
	Bucket: config.s3.bucket,
	Key: config.s3.env + '/covers.json'
}	
s3.getObject(getParams, function (err, data) {
	if (err) {
		console.log(err);
	} else {
		 savedCovers = JSON.parse(data.Body.toString());
	}
})	

getParams = {
	Bucket: config.s3.bucket,
	Key: config.s3.env + '/teachers.json'
}	
s3.getObject(getParams, function (err, data) {
	if (err) {
		console.log(err);
	} else {
		 teachers = JSON.parse(data.Body.toString());
	}
})	

function getEvents() {
	var events = [];
	for(var i=0; i<schoolDates.dates.length; i++) {
		var eventData;
		if(schoolDates.dates[i].type === 'cover') {
			eventData = 
			{
				title: 'View Cover',
				url: '/Attendance?date='+schoolDates.dates[i].date,
				start: formatDate(new Date(schoolDates.dates[i].date))
			};
		}
		if(schoolDates.dates[i].type === 'break') {
			eventData = 
			{
				title: schoolDates.dates[i].text,
				start: formatDate(new Date(schoolDates.dates[i].date))
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
	var day = ("0" + date.getDate()).slice(-2);
	var month = ("0" + (date.getMonth() + 1)).slice(-2);
	var year = date.getFullYear();

	return year + '-' + month + '-' + day;
}	

function deriveCovers(date) {
	var covers = []
	
	for(var i=0; i<defaultCovers.defaults.length; i++) {
		
		var defaultCover = defaultCovers.defaults[i];
		var cover = savedCovers.covers.find(c => c.date === date && c.year === defaultCover.year && c.subject === defaultCover.subject);

		if(cover) {
			covers.push(cover);
		} else {
			cover = 
			{
				date : date,
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
	var covers;
	
	var cover = savedCovers.covers.find(c => c.date === date && c.year === year && c.subject === subject);

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
		var date = data.date;
		var year = data.year;
		var subject = data.subject;
		var teachers = data.teachers;
		
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
			s3.putObject(putParams, function(err, data) {
				if (err) {
					console.log(err, err.stack);
				}
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
