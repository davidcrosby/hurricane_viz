class point {
    constructor(arr) {
        this.x = parseFloat(arr[0]);
        this.y = parseFloat(arr[1]);
    };

    sub(p) {
        return new point([this.x - p.x, this.y - p.y]);
    };

    add(p) {
        return new point([this.x + p.x, this.y + p.y]);
    };

    scale(factor) {
        this.x = this.x * factor;
        this.y = this.y * factor;
    };

    samplePointsBy(delta) {
        pass
    };
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
    // TODO: rewrite this and clean it up
    var dataObject = d3.dsvFormat("|").parse(data);
    // window makes it global even tho its defined inside a function
    window.lines = [] // Models -> Piecewise linear functions
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
                        
                    } else {
                        continue;
                    };
                };
            };
        };
    });
};

function generateSamplePoints(lines) {
    var output = []
    for (var t = 0; t < 120; t += 0.1) {
        lines.forEach(function(line) {
            if(line.definedAt(t)) {
                p = line.valueAt(t);
                output.push([p.x, p.y]);
            };
        });
    };
    return output;
}

function generateSamplePointsDistance(lines) {
    // TODO
    var delta = [0.1, 0.1];
    return
}

function splattingMap(points, width, height) {
    map = new Array();
    for (var i = 0; i < width; i++) {
        map[i] = new Array();
        for (var j=0; j < height; j++) {
            map[i][j] = 0;
        }
    }
   
    points.forEach(function(p) {
        // Splat and record
        var x = Math.round(p[0]),
            y = Math.round(p[1]);

        // how big of a grid to alter values around x,y
        var splat_size = 16;
        if(x < splat_size/2 || y < splat_size/2) 
            return;
        
        var gridx = x-splat_size/2;
            gridy = y-splat_size/2;
        var rect = splat_size;

        // add 1 to each square going in 1 layer at a time
        while(gridx <= x && gridy <= y) {
            for(var i = gridx; i <= gridx + rect; i++) {
                for(var j = gridy; j <= gridy + rect; j++) {
                    map[i][j] += 1;
                };
            };
            rect -= 2;
            gridx += 1;
            gridy += 1;
        };
    });
    return map;
};

function sum(array) {
    var s = 0;
    array.forEach(function(x) {
        s += x;
    });
    return s
}

function latlong2longlat(point) {
    // Also converts west to east
    return [-point[1], point[0]];
};

// d3 Settings
var width = 1000,
    height = 600;

// TODO: Don't hard code projection parameters
var measuredStart = [13.8, 67]
var centerCoords = [15, 85]
var projection = d3.geoEquirectangular()
    .center(latlong2longlat(centerCoords))
    .scale(1400);

var path = d3.geoPath().projection(projection);

function color(thresholdValue, max, index) {
    return d3.hsv(0, 1, .65 + (thresholdValue/max));
};
d3.json("../shapefiles/land.json", function(error, data) {
    if (error) throw error;
    d3.select("svg")
        .attr("width", width)
        .attr("height", height)
        .append("path")
        .attr("d", path(data))
        .style("fill", "lightblue");

    var points = generateSamplePoints(window.lines).map(x => projection(x));
    var map = splattingMap(points, width, height);
    var debuggingZeros = new Array();
    for(var i = width/2 - 40; i < width/2 + 40; i++) {
        for (var j = height/2 - 20; j < height/2 + 20; j++) {
            if(map[i][j] == 0) {
                debuggingZeros.push([i, j])
            }
        }
    }
    values = new Array(width * height);
    for (var i = 0; i < width; ++i) {
        for(var j = 0; j < height; ++j) {
            values[i + j * width] = map[i][j];
        };
    };
    thresholds = new Array();
    thresholds.push(1);
    
    var interpv = d3.interpolateNumber(d3.min(values), d3.max(values))
    for (var j = 0.1; j <= 1; j+=0.1) {
        thresholds.push(interpv(j));
    }
    var con = d3.contours().size([width, height]).thresholds(thresholds)(values);
    for (var i = 0; i < con.length; i++) {
        var polygons = con[i].coordinates;
        for (var j = 0; j < polygons.length; j++) {
            var polygon = polygons[j];
            d3.select("svg")
                .append("polygon")
                .attr("points", polygon.map(function(e) {
                    return e.join(",");
                }).join(" "))
                .attr("fill", color(thresholds[i], d3.max(thresholds), i))
                .attr("stroke", "black")
                .attr("stroke-width", 0);
        }
    };
    console.log(debuggingZeros);
    d3.select("svg").data(debuggingZeros).enter()
        .append("circle")
        .attr("cx", function(d) {
            return d[0];
        })
        .attr("cy", function(d) {
            return d[1];
        })
        .attr("r", "2px")
        .attr("fill", "green");
        /*
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
        .attr("stroke", "blue")
        */
    
});

