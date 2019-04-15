class Point {
    constructor(arr) {
        this.x = parseFloat(arr[0]);
        this.y = parseFloat(arr[1]);
    };

    sub(p) {
        return new Point([this.x - p.x, this.y - p.y]);
    };

    add(p) {
        return new Point([this.x + p.x, this.y + p.y]);
    };

    scale(factor) {
        this.x = this.x * factor;
        this.y = this.y * factor;
    };

    samplePointsBy(delta) {
        pass
    };
}

class LineSegment {
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
        var output = [];


    };

    generateSamplePointsByTime() {
        var output = []
        for (var t = 0; t < 120; t += 0.5) {
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

class MultiLineCollection {
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
                if (baseLength == 1) {
                    map[x][y] = height;
                    return;
                };
                if(x < baseLength/2 || y < baseLength/2) 
                    return;
                var xDelta = Math.floor(baseLength/2),
                    yDelta = Math.floor(baseLength/2);
            
                var pointDistance = function(x1, y1, x2, y2) {
                    return Math.sqrt((x1-x2)**2 + (y1-y2)**2);
                };

                var maxDistance = pointDistance(x, y, x-xDelta - 0.5, y-yDelta - 0.5);
                var layerSize = 2 * xDelta;
                var xp = x - xDelta,
                    yp = y - yDelta;

                while(xp <= x && yp <= y) {
                    // Distance from starting corner to furthest starting corner
                    if (x != xp && y != yp) {
                        var pd = pointDistance(xp, yp, x - xDelta - 0.5, y - yDelta - 0.5);
                    } else {
                        map[xp][yp] += height;
                        break;
                    };
                    for(var i = xp; i <= xp + layerSize; i++) {
                        for(var j = yp; j <= yp + layerSize; j++) {
                            if (i != xp && j != yp && i != xp+layerSize && j != yp+layerSize)
                                continue;
                            var heightAtThisPoint = height*(pd/maxDistance);
                            if(map[i][j]) {
                                map[i][j] += heightAtThisPoint;
                            } else {
                                map[i][j] = heightAtThisPoint;
                            };
                        };
                    };
                    layerSize -= 2;
                    xp += 1;
                    yp += 1;
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
    var trackData = d3.dsvFormat("|").parse(data);
    // window makes it global even tho its defined inside a function
    window.trackCollection = new MultiLineCollection([]) // Models -> Piecewise linear functions
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
                    var startPoint = new Point(latlong2longlat(track[property].split(" ")));
                    if (!firstLineDrawn) { // Add line to measuredStart
                        var ms = new Point(latlong2longlat(measuredStart));
                        trackLines.push(new LineSegment(ms, startPoint, [0,startTime]))
                        firstLineDrawn = true;
                    };

                    // Find next timestep that has valid position data
                    // Sometimes the track might not be defined every 6 hours
                    var endTime = findNextValidPoint(startTime, track);

                    // check if we are at the last point, mainly for tracks that end before t=120
                    if (endTime != "") {
                        var endPoint = new Point(latlong2longlat(track[endTime].split(" ")));
                        trackLines.push(new LineSegment(startPoint, endPoint, [startTime, parseInt(endTime)]));
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

function thresholdColor(thresholdValue, maxThresholdValue) {
    var ratio = thresholdValue/maxThresholdValue;
    return d3.hsv(0, 1, .65 + Math.min(.35, ratio));
};

function plotContours() {
    var map = window.trackCollection.createSplattingMap();

    // construct density values for contour plotting
    var values = new Array(width * height);
    for (var i = 0; i < width; ++i) {
        for(var j = 0; j < height; ++j) {
            values[i + j * width] = map[i][j];
        };
    };
    var thresholds = [];
    var mean = d3.mean(values);
    thresholds.push(150);
    for (var i = 4; i <= 16; i += 4) {
        thresholds.push(mean * i);
    };
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
                    .attr("fill", thresholdColor(thresholds[i], d3.max(thresholds)))
                    .attr("stroke", "black")
                    .attr("stroke-width", 1)
                    .attr("opacity", .5)
            }
        });
    };
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
        .style("fill", d3.hsv(122, .5, .74));

    plotContours();

    /* Code to show the base spaghetti plot
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
            .attr("stroke-width", 0.4)
            .attr("stroke", "blue")
    });
    */
});