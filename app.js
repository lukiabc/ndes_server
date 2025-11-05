require('dotenv').config(); // 加载环境变量
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var testRouter = require('./test');
var articleRouter = require('./routes/article');
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var categoriesRouter = require('./routes/categories');
var reviewsRouter = require('./routes/reviews');
const sensitiveWordRouter = require('./routes/sensitiveWord');
const articleVersionRouter = require('./routes/articleVersion');
const carouselRouter = require('./routes/carousels');

var cors = require('cors');
var app = express();
const jwt = require('./utils/jwt');
const { sequelize } = require('./utils/db');
const { loadWords } = require('./utils/sensitive');
loadWords(); // 加载词库
const cronJob = require('./utils/cronJob');
cronJob(); // 启动定时任务

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(cors()); // 使用cors中间件解决跨域问题
app.use(jwt);
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // 静态资源

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/test', testRouter);
app.use('/article', articleRouter);
app.use('/categories', categoriesRouter);
app.use('/reviews', reviewsRouter);
app.use('/sensitive', sensitiveWordRouter);
app.use('/articleVersion', articleVersionRouter);
app.use('/carousel', carouselRouter);

// 同步所有模型到数据库
sequelize
    .sync()
    .then(() => {
        console.log('所有数据库模型同步成功');
    })
    .catch((error) => {
        console.error('数据库模型同步失败：', error);
    });

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

app.listen(3000, () => {
    console.log('服务器启动成功');
});

module.exports = app;
