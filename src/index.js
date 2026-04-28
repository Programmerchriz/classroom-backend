"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var app = (0, express_1.default)();
var PORT = 8000;
app.use(express_1.default.json());
app.get("/", function (req, res) {
    res.send("Hello, welcome to the Classroom API");
});
app.listen(PORT, function () {
    console.log("Server is running at http://localhost:".concat(PORT));
});
