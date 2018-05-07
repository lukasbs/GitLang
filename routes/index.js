var express = require('express');
var router = express.Router();

var Language = require("../models/Language");
const {createApolloFetch} = require("apollo-fetch");

var responseRender;

router.get('/', function (req, res, next) {
    res.render('index', {title: 'GitLang', renderInfo: false});
});

router.post('/submit', function (req, res, next) {
    var userName = req.body.userName;
    res.redirect('/submit/' + userName);
});

router.get('/submit/:userName', function (req, res, next) {
    responseRender = res;

    const uri = 'https://api.github.com/graphql';
    const query = '{user(login: "' + req.params.userName + '") {email repositories(first: 100){ edges{ node{ primaryLanguage{name} name languages(first: 100) { edges{ node{ name } size } } } } } } }';
    const apolloFetch = createApolloFetch({uri});

    apolloFetch.use(({request, options}, next) => {
        if (!options.headers) {
            options.headers = {};
        }

        // get your token from safe datasource / Config Variables at heroku, or hardcode it if you want...

        options.headers['authorization'] = 'Bearer ' + token;

        next();
    });

    apolloFetch({query}).then(res => {
        calculatePercentage(res.data.user.repositories.edges);
        renderApp(res.data.user.repositories.edges, req.params.userName, res.data.user.email);
    }).catch(error => {
        renderAppError();
        console.log(error);
    });
});

router.get('*',function (req, res) {
    res.redirect('/');
});

function renderApp(repos, name, mail) {
    responseRender.render('index', {
        conditionRest: calculatePercentage(repos).length > 10,
        langRest: calculatePercentage(repos).slice(11),
        renderInfo: true,
        conditionRepos: repos.length > 0,
        title: 'GitLang',
        userName: name,
        userEmail: mail != '' ? mail : 'This user did not set his public mail!',
        userRepos: repos,
        globalLanguages: calculatePercentage(repos)
    });
}

function renderAppError() {
    responseRender.render('index', {
        renderInfo: true,
        title: 'Error Page',
        error: 'There is no such user!!'
    });
}

function calculatePercentage(repos) {
    var globalLangs = [];
    var allLangsCount = 0;
    var set = new Set();

    for(let repo of repos){
        for(let lang of repo.node.languages.edges){
            set.add(lang.node.name);
        }
    }

    for(let singleLang of set){
        var tempVal = 0;
        for(let repo of repos){
            for(let lang of repo.node.languages.edges){
                if(singleLang == lang.node.name) {
                    tempVal += lang.size;
                }
            }
        }
        allLangsCount += tempVal;
        globalLangs.push(new Language(singleLang,tempVal));
    }

    for(let lang of globalLangs) {
        lang.percentage = ((lang.amount / allLangsCount) * 100).toFixed(4);
    }

    var globalLangsSorted = globalLangs.slice();
    globalLangsSorted.sort(function(a,b) {
        return b.amount - a.amount;
    });

    return globalLangsSorted;
}

module.exports = router;