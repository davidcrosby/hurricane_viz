class point {
    constructor(arr) {
        this.x = parseFloat(arr[0]);
        this.y = parseFloat(arr[1]);
    }

    sub(p) {
        return new point([this.x - p.x, this.y - p.y]);
    }
    add(p) {
        return new point([this.x + p.x, this.y + p.y]);
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
        this.length = (range[1] - range[0]);
    }

    definedAt(time) {
        if (this.range[0] <= time && this.range[1] >= time) {
            return true;
        } else {
            return false;
        }
    }
    valueAt(time) {
        var displacement = this.end.sub(this.start);
        var normalizedTime = (time - this.range[0]);
        displacement.scale(normalizedTime/this.length);
        return this.start.add(displacement);
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
                        var ms = new point(latlong2longlat(measuredStart));
                        window.lines.push(new line(ms, startPoint, [0,startTime]))
                        firstLineDrawn = true;
                    }
                    var endTime = findNextValidPoint(startTime, object);
                    if (endTime != "") {
                        var endPoint = new point(latlong2longlat(object[endTime].split(" ")));
                        window.lines.push(new line(startPoint, endPoint, [startTime, parseInt(endTime)]));
                        
                        desc.push(object);
                    } else {
                        continue;
                    };
                };
            };
        };
    });
    generateSamplePoints(window.lines);
};

function generateSamplePoints(lines) {
    var output = []
    for (var t = 0; t < 120; t += 0.5) {
        lines.forEach(function(line) {
            if(line.definedAt(t)) {
                p = line.valueAt(t);
                output.push([p.x, p.y]);
            };
        });
    };
    return output;
}

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

    d3.select("svg").selectAll("dot")
        .data(generateSamplePoints(lines)).enter()
        .append("circle")
        .attr("cx", function(d) { 
            return projection(d)[0];
        })
        .attr("cy", function(d) { 
            return projection(d)[1];
        })
        .attr("r", "1px")
        .attr("fill", "red");
    /*
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
        */
});

