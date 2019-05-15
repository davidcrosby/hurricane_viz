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
    constructor(start, end, range, wind) {
        this.start = start;
        this.end = end;
        this.wind = wind;
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

    windAt(time) {
        var [ws, we] = this.wind;
        var normalizedTime = (time - this.range[0]);
        var out = ws + (we - ws)*normalizedTime/this.length;
        return ws + (we - ws)*normalizedTime/this.length;
    }
};

class multiLine {
    // A collection of connected lines representing one bigger line!
    constructor(lines) {
        this.lines = lines;
    };

    resolveWind() {
        this.lines.forEach(function(line) {
            if(isNaN(line.wind[0])) {
                line.wind[0] = window.windTotals[line.range[0]]
            };
            if(isNaN(line.wind[1])) {
                line.wind[1] = window.windTotals[line.range[1]]
            };
        });
    }

    generateSamplePointsByDistance(distance) {
        var out = [];
        this.lines.forEach(function(line) {
            var start = new Point(projection([line.start.x, line.start.y])),
                end = new Point(projection([line.end.x, line.end.y]));
            var point = new Point(projection([line.start.x, line.start.y]));
            var time = line.range[0]; // start time
            var disp = new Point([
                end.x - start.x,
                end.y - start.y
            ]);
            var lineLength = pointDistance(start.x, start.y, end.x, end.y);
            var count = Math.round(lineLength/distance);
            disp.scale((distance)/lineLength)
            for(var i = 0; i < count; i++) {
                out.push([point, time]);
                point = point.add(disp);
                var pd = pointDistance(start.x, start.y, point.x, point.y);
                time = line.range[0] + line.length * (pd/lineLength);
            };
        });
        return out;
    };

    generateSamplePointsByTime() {
        var output = []
        for (var t = 0; t < 120; t += .1) {
            this.lines.forEach(function(line) {
                if(line.definedAt(t)) {
                    var p = line.valueAt(t);
                    output.push([p, t, line.windAt(t)]);
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

    createSplattingMap(samplingType) {
        // samplingType : String : {"time", "distance"}
        // Sample pts for each track and update the dmap with their splats
        var dmap = {}
        var windmap = {};
        for (var i = 0; i < width; i++) {
            dmap[i] = {};
            windmap[i] = {};
            for (var j=0; j < height; j++) {
                dmap[i][j] = 0;
                windmap[i][j] = [0, 0];
            };
        };

        var volume = 4000;
        var max_size = Math.floor(Math.sqrt(3*volume)) // when height = 1
        this.multiLines.forEach(function(track) {
            if (samplingType === "time") {
                var trkPoints = track.generateSamplePointsByTime()
            } else if (samplingType === "distance") {
                var trkPoints = track.generateSamplePointsByDistance(1);
            }
            trkPoints.forEach(function(pointTime) {
                var [p, time, wind] = pointTime
                if (samplingType === "time") {
                    var [x, y] = projection([p.x, p.y]).map(x => Math.round(x));
                } else if (samplingType === "distance") {
                    var [x, y] = [p.x, p.y].map(x => Math.round(x));
                };

                // length and width
                var baseLength = Math.round(1 + (time/120)*max_size);
                // V = lwh/3
                var height = 3 * volume / (baseLength**2)
                if (baseLength == 1) {
                    dmap[x][y] = height;
                    return;
                };
                if(x < baseLength/2 || y < baseLength/2) 
                    return;
                var xDelta = Math.floor(baseLength/2),
                    yDelta = Math.floor(baseLength/2);
            
                

                var maxDistance = pointDistance(x, y, x-xDelta - 0.5, y-yDelta - 0.5);
                var layerSize = 2 * xDelta;
                var xp = x - xDelta,
                    yp = y - yDelta;

                while(xp <= x && yp <= y) {
                    // Distance from starting corner to furthest starting corner
                    if (x != xp && y != yp) {
                        var pd = pointDistance(xp, yp, x - xDelta - 0.5, y - yDelta - 0.5);
                    } else {
                        dmap[xp][yp] += height;
                        break;
                    };
                    for(var i = xp; i <= xp + layerSize; i++) {
                        for(var j = yp; j <= yp + layerSize; j++) {
                            if (i != xp && j != yp && i != xp+layerSize && j != yp+layerSize)
                                continue;
                            var heightAtThisPoint = height*(pd/maxDistance);
                            // update density
                            if(dmap[i][j]) {
                                dmap[i][j] += heightAtThisPoint;
                            } else {
                                dmap[i][j] = heightAtThisPoint;
                            };
                            // update wind value
                            if (windmap[i][j]) {
                                windmap[i][j][0] += wind;
                                windmap[i][j][1] += 1
                            } else {
                                windmap[i][j] = [wind, 1];
                            }
                        };
                    };
                    layerSize -= 2;
                    xp += 1;
                    yp += 1;
                };
            });
        });
        // replace wind sum with average
        for (var x in windmap) {
            if (windmap.hasOwnProperty(x)) {
                for (var y in windmap[x]) {
                    if(windmap[x].hasOwnProperty(y)) {
                        // min threshold
                        if (dmap[x][y] < 200) {
                            windmap[x][y] = 0;
                            continue;
                        }
                        if (windmap[x][y] && windmap[x][y][1] !== 0) {
                            windmap[x][y] = windmap[x][y][0]/windmap[x][y][1];
                        } else {
                            windmap[x][y] = 0;
                        }
                    }
                }
            }
        }
        return [dmap, windmap];
    };
};
var pointDistance = function(x1, y1, x2, y2) {
    return Math.sqrt((x1-x2)**2 + (y1-y2)**2);
};
// Load csv data and compute functions to sample
$.ajax({
    url:"../model_data/harvey_wind.csv",
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
    // TODO: reconsider wind when data missing, how to handle
    var trackData = d3.dsvFormat("|").parse(data);
    // window makes it global even tho its defined inside a function

    // Keep track of winds at each point to get an average
    window.windTotals = {};
    for(var i = 0; i <= 120; i+=6) {
        windTotals[i] = [];
    }

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
                    var data = track[property].split(" ");
                    var startPoint = new Point(latlong2longlat([data[0], data[1]]));
                    var startWind = parseInt(data[2]);
                    if (!firstLineDrawn) { // Add line to measuredStart
                        var ms = new Point(latlong2longlat(measuredStart));
                        trackLines.push(new LineSegment(ms, startPoint, [0,startTime], [measuredStart[2], startWind]))
                        if(startWind)
                            windTotals[startTime].push(startWind);
                        firstLineDrawn = true;
                    };

                    // Find next timestep that has valid position data
                    // Sometimes the track might not be defined every 6 hours
                    var endTime = findNextValidPoint(startTime, track);
                    // check if we are at the last point, mainly for tracks that end before t=120
                    if (endTime != "") {
                        var endData = track[endTime].split(" ");
                        var endWind = parseInt(endData[2]);
                        if(endWind)
                            windTotals[endTime].push(endWind);
                        var endPoint = new Point(latlong2longlat([endData[0], endData[1]]));
                        trackLines.push(new LineSegment(startPoint, endPoint, [startTime, parseInt(endTime)], [startWind, endWind]));
                    } else {
                        continue;
                    };
                };
            };
        };
        window.trackCollection.add(new multiLine(trackLines));

    });
    for(var i = 0; i <= 120; i+=6) {
        window.windTotals[i] = d3.mean(windTotals[i]);
    };
    window.trackCollection.multiLines.forEach(function(line) {
        line.resolveWind();
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
var measuredStart = [13.8, 67, 35]
var centerCoords = [15, 85]
var projection = d3.geoEquirectangular()
    .center(latlong2longlat(centerCoords))
    .scale(1400);

var path = d3.geoPath().projection(projection);

function thresholdColor(thresholdValue, maxThresholdValue, index, scheme) {
    var ratio = thresholdValue/maxThresholdValue;
    if (scheme == "value") {
        var ratio = thresholdValue/maxThresholdValue;
        return d3.hsv(0, 1, .65 + Math.min(.35, ratio));
    };
    if (scheme == "colors") {
        var ca = [20, 15, 5, 0, 0];
        return d3.hsv(ca[index], 1, 1);
    };
    if (scheme == "saturation") {
        return d3.hsv(0, .6 + Math.min(.4, ratio), 1);
    };
    if (scheme == "value+sat") {
        return d3.hsv(0, .6 + ratio, .45 + ratio);
    };
    if (scheme == "color+sat") {
        var ca = [20, 15, 5, 0, 0];
        return d3.hsv(ca[index], .6 + Math.min(.4, ratio), 1);
    };
    if (scheme == "triple") {
        var ca = [20, 15, 10, 5, 0];
        return d3.hsv(ca[index], .8 + Math.min(.2, ratio), .8 + Math.min(.2, ratio));
    };
    // for overlaying wind speed
    if (scheme == "darkness") {
        return d3.hsv(0, 0, .05);//(ratio * .4));
    };
};


function plotHeatMap() {
    var beaufortColors = {
        1: "#adf1f9",
        4: "#96f7dc",
        7: "#96f7b4",
        11: "#6ff4gf",
        17: "#73ed14",
        22: "#a4ed14",
        28: "#daed14",
        34: "#edc214",
        41: "#ed8f12",
        48: "#ed6312",
        56: "#ed2712",
        64: "#d50e2d"
    }
    var getColorByWind = function(wind) {
        var last = beaufortColors[64];
        for(var key in beaufortColors) {
            if (wind < key) {
                return beaufortColors[key]
            }
            last = beaufortColors[key];
        }
        return last;
    }
    // d -> density, w -> width
    var [dmap, windmap] = window.trackCollection.createSplattingMap("time");
    var wvalues = new Array(width * height);
    for(var i =0;i<width;i++){
        for(var j =0;j<height;j++){
            wvalues[i + j*width] = windmap[i][j];
        };
    };
    var dvalues = new Array(width * height);
    for(var i =0;i<width;i++) {
        for(var j =0;j<height;j++) {
            dvalues[i + j*width] = dmap[i][j];
        };
    };
    // Construct and plot wind speed contours
    var wthresholds = [1,4,7,11,17,22,28,34,41,48,56,64];
    var wcontours = d3.contours().size([width, height]).thresholds(wthresholds)(wvalues);
    for (var i =0;i<wcontours.length;i++){
        wcontours[i].coordinates.forEach(function(polygons){
            for(var j=0;j<polygons.length;j++){
                var polygon = polygons[j];
                d3.select("svg")
                    .append("polygon")
                    .attr("points", polygon.map(function(e) {
                        return e.join(",");
                    }).join(" "))
                    .attr("fill", getColorByWind(wthresholds[i]))
                    .attr("stroke-width", 0)
                    .attr("opacity", .35);

            }
        })
    }

    // Construct and plot uncertainty countours
    var dthresholds = [];
    var mean = d3.mean(dvalues);
    dthresholds.push(200);
    for (var i = 4; i <= 16; i += 4) {
        dthresholds.push(mean * i);
    };
    var dcontours = d3.contours().size([width, height]).thresholds(dthresholds)(dvalues);
    var dasharrayValues = function(thresholdValue) {
        var maxThresholdValue = d3.max(dthresholds);
        var ratio = thresholdValue/maxThresholdValue;
        var pixelsOff = Math.round(30 - (ratio * 25));
        var pixelsOn = Math.max(7, Math.round(ratio * 30));
        var out = parseInt(pixelsOn) + "," + parseInt(pixelsOff);
        return out;
    }
    var maxThresholdValue = d3.max(dthresholds);
    for (var i = 0; i < dcontours.length; i++) {
        // coordinates is a list of polygons
        dcontours[i].coordinates.forEach(function(polygons){
            for (var j = 0; j < polygons.length; j++) {
                var polygon = polygons[j];
                d3.select("svg")
                    .append("polygon")
                    .attr("points", polygon.map(function(e) {
                        return e.join(",");
                    }).join(" "))
                    .attr("stroke", "black")
                    .attr("stroke-width", 2)
                    .attr("stroke-dasharray", dasharrayValues(dthresholds[i]))
                    .attr("fill-opacity", .1)
                    .attr("stroke-opacity", .7)
                    .attr("fill", thresholdColor(dthresholds[i], maxThresholdValue, i, "darkness"));
            }
        })
    }
}
function plotContours() {
    var [dmap, windmap] = window.trackCollection.createSplattingMap("time");

    // construct density values for contour plotting
    var values = new Array(width * height);
    for (var i = 0; i < width; ++i) {
        for(var j = 0; j < height; ++j) {
            values[i + j * width] = dmap[i][j];
        };
    };
    var thresholds = [];
    var mean = d3.mean(values);
    thresholds.push(200);
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
                    .attr("stroke", "black")
                    .attr("stroke-width", 2)
                    .attr("stroke-dasharray", "10,10")
                    .attr("opacity", .5)
                    .attr("fill", thresholdColor(thresholds[i], d3.max(thresholds), i, "value+sat"));
            }
        })
    }
}
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
        .style("fill", "beige");

    //plotContours();
    plotHeatMap();
    
    /* Show distance based sampling:
    var color = d3.hsv(0, 1, 1);
    var counter = 0;
    trackCollection.multiLines.forEach(function(trk) {
        //console.log(trk.generateSamplePointsByTime());
        d3.select("svg").selectAll("dot")
            .data(trk.generateSamplePointsByDistance(5)).enter()
            .append("circle")
            .attr("cx", function(d) {
                d = d[0];
                //console.log(Math.round(d.x));
                return Math.round(d.x);
            })
            .attr("cy", function(d) { 
                d = d[0];
                return Math.round(d.y);
            })
            .attr("r", "2px")
            .attr("fill", color);
        counter += 4;
        color = d3.hsv(counter, 1, 1);
    });
    */
   /* time based splatting plot
   var color = d3.hsv(0, 1, 1);
   var counter = 0;
   trackCollection.multiLines.forEach(function(trk) {
       d3.select("svg").selectAll("dot")
           .data(trk.generateSamplePointsByTime()).enter()
           .append("circle")
           .attr("cx", function(d) {
               d = d[0];
               return projection([d.x, d.y])[0];
           })
           .attr("cy", function(d) {
               d = d[0];
               return projection([d.x, d.y])[1];
           })
           .attr("r", "2px")
           .attr("fill", color);
           counter += 4;
           color = d3.hsv(counter, 1, 1);
   });
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