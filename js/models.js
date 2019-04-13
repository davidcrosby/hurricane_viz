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
        this.start = start;
        this.end = end;
        this.range = range; // [start_time, end_time]
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
        // f(t) = start + t*displacement
        var displacement = this.end.sub(this.start);

        // we want time from start of line, not from start of data
        var normalizedTime = (time - this.range[0]); 
        displacement.scale(normalizedTime/this.length);
        return this.start.add(displacement);
    };
};

class multiLine {
    // A collection of connected lines representing one bigger line!
    constructor(lines) {
        // sort by start time
        this.lines = lines.sort(function(a, b) {
            return a.start - b.start;
        });
    };

    genSamplePointsByDistance() {
        pass;
    };

    generateSamplePointsByTime() {
        var output = []
        for (var t = 0; t < 120; t += 0.1) {
            this.lines.forEach(function(line) {
                if(line.definedAt(t)) {
                    var p = line.valueAt(t);
                    output.push([p, t]);
                };
            });
        };
        return output;
    }
}

class multiLineCollection {
    // A collection of multiLines
    constructor(multiLines) {
        this.multiLines = multiLines
    };

    add(multiLine) {
        this.multiLines.push(multiLine);
    }

    samplePoints() {
        var output = [];
        for (var index in this.multiLines) {
            var pts = this.multiLines[index].generateSamplePointsByTime();
            output.push(...pts);
        };
        return output;
    }

    createSplattingMap() {
        // Sample pts for each track and update the map with their splats
        var map = {}
        for (var i = 0; i < width; i++) {
            map[i] = {}
            for (var j=0; j < height; j++) {
                map[i][j] = 0;
            };
        };

        var volume = 4000;
        var max_size = Math.floor(Math.sqrt(3*volume)) // when height = 1
        this.multiLines.forEach(function(track) {
            var trkPoints = track.generateSamplePointsByTime()
            trkPoints.forEach(function(pointTime) {
                var [p, time] = pointTime
                var [x, y] = projection([p.x, p.y]).map(x => Math.round(x));

                // length and width
                var baseLength = Math.round(1 + (time/120)*max_size);

                // V = lwh/3
                var height = 3 * volume / (baseLength**2)

                if(x < baseLength/2 || y < baseLength/2) 
                    return;
                var gridx = x - Math.round(x-baseLength/2),
                    gridy = y - Math.round(y-baseLength/2);

                var pointDistance = function(x1, y1, x2, y2) {
                    return Math.sqrt((x1-x2)**2 + (y1-y2)**2);
                };
                var heightInterpolater = d3.interpolateNumber(0, height);
                var maxDistance = pd ? pd : 1;
                for(var i = x - gridx; i <= x + gridx; i++) {
                    for(var j = y - gridy; j <= y + gridy; j++) {
                        var pd = pointDistance(i, j, x, y);
                        var d = pd ? pd : 1;
                        map[i][j] += heightInterpolater(d/maxDistance);
                    };
                };
            });
        });
        return map;
    };
};
// Load csv data and compute functions to sample
$.ajax({
    url:"../model_data/harvey.csv",
    dataType: "text"
}).done(readData)

function findNextValidPoint(startTime, track) {
    // Find the next available point in track after startTime
    // Return the time of the point as a string
    var nextTime = startTime;
    while(nextTime <= 120) {
        var nextTime = nextTime + 6;
        var p = track[String(nextTime)];
        if (p && p != "-") {
            return String(nextTime);
        }
    }
    return "";
}

function readData(data) {
    // TODO: rewrite this and clean it up
    // TODO: add a model class containing all lines for a track
    var trackData = d3.dsvFormat("|").parse(data);
    // window makes it global even tho its defined inside a function
    window.trackCollection = new multiLineCollection([]) // Models -> Piecewise linear functions
    trackData.forEach(function(track) {

        trackLines = []
        // Draw from the measured start
        // TODO: Scrape with the start time and omit this
        var firstLineDrawn = false;
        for (var property in track) {
            if (track.hasOwnProperty(property)) {
                // Skip the model name, empty positions, and the last point
                var avoid = (property === "description") || (property == "120") || (track[property] == "-");
                if (!track[property]) avoid = true;
                if (avoid) {
                    continue; // Skip descriptions and ends
                } else {
                    var startTime = parseInt(property);
                    var startPoint = new point(latlong2longlat(track[property].split(" ")));
                    if (!firstLineDrawn) { // Add line to measuredStart
                        var ms = new point(latlong2longlat(measuredStart));
                        trackLines.push(new line(ms, startPoint, [0,startTime]))
                        firstLineDrawn = true;
                    };

                    // Find next timestep that has valid position data
                    // Sometimes the track might not be defined every 6 hours
                    var endTime = findNextValidPoint(startTime, track);

                    // check if we are at the last point, mainly for tracks that end before t=120
                    if (endTime != "") {
                        var endPoint = new point(latlong2longlat(track[endTime].split(" ")));
                        trackLines.push(new line(startPoint, endPoint, [startTime, parseInt(endTime)]));
                    } else {
                        continue;
                    };
                };
            };
        };
        window.trackCollection.add(new multiLine(trackLines));
    });
};

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

function color(thresholdValue, max, index, count) {
    var ratio = thresholdValue/max;
    return d3.hsv(count - index, 1, .65 + ratio);
};

d3.json("../shapefiles/land.json", function(error, data) {
    if (error) throw error; // oh no!
    // Fill the ocean
    d3.select("svg")
        .append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "lightblue")
    
    // draw land attributes
    d3.select("svg")
        .attr("width", width)
        .attr("height", height)
        .append("path")
        .attr("d", path(data))
        .style("fill", "white");

    var map = window.trackCollection.createSplattingMap();

    // construct density values for contour plotting
    values = new Array(width * height);
    for (var i = 0; i < width; ++i) {
        for(var j = 0; j < height; ++j) {
            values[i + j * width] = map[i][j];
        };
    };
    thresholds = new Array();
    thresholds.push(1);
    
    // interpolate between [0,1] and the extent of the density values
    var interpv = d3.interpolateNumber(d3.min(values), d3.max(values))
    for (var j = 0.1; j <= .8; j += .05) {
        thresholds.push(interpv(j));
    }
    var con = d3.contours().size([width, height]).thresholds(thresholds)(values);
    for (var i = 0; i < con.length; i++) {
        // coordinates is a list of polygons
        con[i].coordinates.forEach(function(polygons){
            for (var j = 0; j < polygons.length; j++) {
                var polygon = polygons[j];
                d3.select("svg")
                    .append("polygon")
                    .attr("points", polygon.map(function(e) {
                        return e.join(",");
                    }).join(" "))
                    .attr("fill", color(thresholds[i], d3.max(thresholds),i,thresholds.length))
                    .attr("stroke", "black")
                    .attr("stroke-width", 1);
            }
        });
    };
        /*
    d3.select("svg").selectAll("dot").data(debuggingZeros).enter()
        .append("circle")
        .attr("cx", function(d) {
            return d[0];
        })
        .attr("cy", function(d) {
            return d[1];
        })
        .attr("r", "2px")
        .attr("fill", "green");
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
    window.trackCollection.multiLines.forEach(function(multiLine) {
        d3.select("svg").selectAll("lines")
            .data(multiLine.lines).enter()
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
    });
        */
        
        
    
});

