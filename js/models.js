
// Load csv data and prepare it for viz
$.ajax({
    url:"../harvey.csv",
    dataType: "text"
}).done(readData)

function readData(data) {
    var dataObject = d3.dsvFormat("|").parse(data);
    console.log(dataObject);
};


