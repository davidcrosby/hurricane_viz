class point {
    constructor(arr) {
        this.x = parseFloat(arr[0]);
        this.y = parseFloat(arr[1]);
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

    definedAt(time) {
        var normalizedTime = (time - this.range[0]);
        if (normalizedTime < range) {
            return true;
        } else {
            return false;
        }
    }
    valueAt(time) {
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
        if (p && p != "-") {
            return String(nextTime);
        }
    }
    return "";
}
function readData(data) {
    var dataObject = d3.dsvFormat("|").parse(data);
    window.lines = [] // Models -> Piecewise linear functions
    // testing
    var desc = [];
    //
    timestamps = [];
    for (var i = 1; i <= 20; i++) {
        timestamps.push(String(i*6));
    }
    dataObject.forEach(function(object) {
        var firstLineDrawn = false;
        for (var property in object) {
            if (object.hasOwnProperty(property)) {
                var avoid = (property === "description") || (property == "120") || (object[property] == "-");
                if (!object[property]) avoid = true;
                if (avoid) {
                    continue; // Skip descriptions and ends
                } else {
                    var startTime = parseInt(property);
                    var startPoint = new point(latlong2longlat(object[property].split(" ")));
                    if (!firstLineDrawn) { // Add line to measuredStart
                        console.log(property);
                        var ms = new point(latlong2longlat(measuredStart));
                        window.lines.push(new line(ms, startPoint, startTime))
                        firstLineDrawn = true;
                    }
                    var endTime = findNextValidPoint(startTime, object);
                    if (endTime != "") {
                        var endPoint = new point(latlong2longlat(object[endTime].split(" ")));
                        window.lines.push(new line(startPoint, endPoint, (parseInt(endTime) - startTime)));
                        
                        desc.push(object);
                    } else {
                        continue;
                    };
                };
            };
        };
    });
    window.lines.forEach(function(line, i) {
        // look for outlier
        var end = projection([line.end.x, line.end.y]);
        if (end[0] > width) {
            console.log(line);
        }
    });
};

function latlong2longlat(point) {
    // Also converts west to east
    return [-point[1], point[0]];
}
// d3 Settings
var width = 1000,
    height = 600;

// TODO: Don't hard code projection parameters
var measuredStart = [13.8, 67]
var centerCoords = [15, 85]
var projection = d3.geoEquirectangular()
    .center(latlong2longlat(centerCoords))
    .scale(1400);
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

    d3.select("svg").selectAll("lines")
        .data(lines).enter()
        .append("line")
        .attr("x1", function(d) {
            var p = d.start;
            return projection([p.x, p.y])[0];
        })
        .attr("y1", function(d) {
            var p = d.start;
            return projection([p.x, p.y])[1];
        })
        .attr("x2", function(d) {
            var p = d.end;
            return projection([p.x, p.y])[0];
        }) 
        .attr("y2", function(d) {
            var p = d.end;
            return projection([p.x, p.y])[1];

        })
        .attr("stroke-width", 1)
        .attr("stroke", "red")
});

