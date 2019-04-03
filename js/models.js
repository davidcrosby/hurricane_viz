class point {
    constructor(arr) {
        this.x = arr[0];
        this.y = arr[1];
    }

    sub(p) {
        return point([this.x - p.x, this.y - p.y]);
    }
    add(p) {
        return point([this.x + p.x, this.y + p.y]);
    }

    scale(factor) {
        this.x = this.x * factor;
        this.y = this.y * factor;
    }
}

class line {
    constructor(start, end, range) {
        // f(t) = start + t * displacement
        this.start = start;
        this.end = end;
        this.range = range;
    }
    at(time) {
        var displacement = this.end.sub(start);
        var timeRange = this.range[1] - this.range[0];
        var normalizedTime = (time - this.range[0]);
        return start.add(displacement.scale(normalizedTime/timeRange));
    };
};

// Load csv data and compute functions to sample
$.ajax({
    url:"../model_data/harvey.csv",
    dataType: "text"
}).done(readData)

function findNextValidPoint(startTime, object) {
    // Find the next available point in object after startTime
    // Return the time of the point as a string
    var nextTime = startTime;
    while(nextTime <= 120) {
        var nextTime = nextTime + 6;
        var p = object[String(nextTime)];
        if (p != "-") {
            return String(nextTime);
        }
    }
    return "";
}
function readData(data) {
    var dataObject = d3.dsvFormat("|").parse(data);
    window.lines = [] // Models -> Piecewise linear functions

    timestamps = [];
    for (var i = 1; i <= 20; i++) {
        timestamps.push(String(i*6));
    }
    for (let model in dataObject) {
        var object = dataObject[model];
        for (var property in object) {
            if (object.hasOwnProperty(property)) {
                var avoid = (property === "description") || (property == "120") || (object[property] == "-");
                if (avoid) {
                    continue; // Skip descriptions and ends
                } else {
                    var startTime = parseInt(property);
                    var endTime = findNextValidPoint(startTime, object);
                    if (endTime) {
                        window.lines.push(new line(object[property], object[endTime], (parseInt(endTime) - startTime)));
                    } else {
                        continue
                    };
                };
            };
        };
    };
    console.log(window.lines);
};

function latlong2longlat(point) {
    // Also converts west to east
    return point([-point.y, point.x]);
}
// d3 Settings
var width = 800,
    height = 1000;

// TODO: Don't hard code projection parameters
var projection = d3.geoEquirectangular()
    .center([-67, 13.8])
    .scale(2200);
    //.postclip(d3.geoClipRectangle(-70, 15, -95, 45));

var path = d3.geoPath().projection(projection);


d3.json("../shapefiles/land.json", function(error, data) {
    if (error) throw error;
    d3.select("svg")
        .attr("width", width)
        .attr("height", height)
        .append("path")
        .attr("d", path(data))
        .style("fill", "lightblue");
});

