// Mock for Hurricane Katrina advisory #15
// Size is inaccurate. I think it is because using modern error data for radii
//  which is smaller than in 2005
// TODO: Automate so it can take any advisory as input
var points = [
    [-83.6, 24.6],
    [-84.6, 24.6],
    [-87.5, 26.0],
    [-89.0, 27.0],
    [-89.5, 30.5],
    //[-87.5, 35.0],
    //[-81.0, 40.5]
]

var lines = [
    [[-83.6, 24.6],
    [-84.6, 24.6]],
    [[-84.6, 24.6],
    [-87.5, 26.0]],
    [[-87.5, 26.0],
    [-89.0, 27.0]],
    [[-89.0, 27.0],
    [-89.5, 30.5]]
]

var nhcRadii = [
    26 * 1852,
    43 * 1852,
    56 * 1852,
    74 * 1852,
    103 * 1852
]

var width = 800,
    height = 1000;

var projection = d3.geoEquirectangular()
    .center([-85, 30])
    .scale(2200);
    //.postclip(d3.geoClipRectangle(-70, 15, -95, 45));

var path = d3.geoPath().projection(projection);


function circlePoints(center, radius) {
    var out = [];
    var xc = center[0], yc = center[1];
    var x = radius - 1, y = 0;
    var dx = 1, dy = 1;
    var err = dx - (radius * 2);
    while (x >= y) {
        out.push([xc + x, yc + y], [xc + y, yc + x]);
        out.push([xc - x, yc + y], [xc - y, yc + x]);
        out.push([xc - x, yc - y], [xc - y, yc - x]);
        out.push([xc + x, yc - y], [xc + y, yc - x]);
        if (err <= 0) {
            y += 1;
            err += dy;
            dy += 2;
        } else {
            x -= 1;
            dx += 2;
            err += dx - (radius * 2);
        };
    };
    return out;
};

function makePoly(points) {
    var poly = []
    for (j = 0; j < points.length-1; j ++) {
        poly.push([points[j], points[j+1]]);
    };
    // Closed
    poly.push([
        points[0],
        points[points.length-1]
    ]);
    return poly;
};
function clipPolygonWith(poly1, poly2) {
    if (poly2.length == 0) {return poly1;}
    var out = [];
    poly1.forEach(function(e) {
        console.log(e);
        if (!d3.polygonContains(poly2, e[0])) {
            out.push(e);
        }
    });
    return out;
}

function polyUnion(poly1, poly2) {
    var out = [];
    clipPolygonWith(poly1, poly2).forEach(function(e) {
        out.push(e);
    });
    clipPolygonWith(poly2, poly1).forEach(function(e) {
        out.push(e);
    });
    return out;
};

var collectedPoints = [];
var circleList = points.map(function(e, i) {
    return [e, nhcRadii[i]];
});

circleList.forEach(function(e) {
    collectedPoints.push(circlePoints(projection(e[0]), e[1]/2200));
});

var currentPolygon = [];

for (i = 0; i < collectedPoints.length-1; i++) {
    console.log(collectedPoints.length, i);
    // Hull of the current circle and the next
    var hp = collectedPoints[i].concat(collectedPoints[i+1]);
    var hullPoints = d3.polygonHull(hp);
    // Construct polygon for new hull
    var nextPolygon = makePoly(hullPoints);
    currentPolygon = polyUnion(currentPolygon, nextPolygon);
};

d3.json("states.json", function(error, data) {
    if (error) throw error;
    d3.select("svg")
        .attr("width", width)
        .attr("height", height)
        .append("path")
        .attr("d", path(data))
        .style("fill", "lightblue");

    // Draw points for each 12hr forecast
    d3.select("svg").selectAll("dot")
        .data(points).enter()
        .append("circle")
        .attr("cx", function(d) { 
            return projection(d)[0];
        })
        .attr("cy", function(d) { 
            return projection(d)[1];
        })
        .attr("r", "8px")
        .attr("fill", "red");
    // Draw lines connecting the points
    d3.select("svg").selectAll("lines")
        .data(lines).enter()
        .append("line")
        .attr("x1", function(d) {
            var p = d[0];
            return projection(p)[0];
        })
        .attr("y1", function(d) {
            var p = d[0];
            return projection(p)[1];
        })
        .attr("x2", function(d) {
            var p = d[1];
            return projection(p)[0];
        }) 
        .attr("y2", function(d) {
            var p = d[1];
            return projection(p)[1];
        })
        .attr("stroke-width", 2)
        .attr("stroke", "red");
    // Convex hull 
    d3.select("svg").selectAll("lines")
        .data(currentPolygon).enter()
        .append("line")
        .attr("x1", function(d) {
            var p = d[0];
            return p[0];
        })
        .attr("y1", function(d) {
            var p = d[0];
            return p[1];
        })
        .attr("x2", function(d) {
            var p = d[1];
            return p[0];
        }) 
        .attr("y2", function(d) {
            var p = d[1];
            return p[1];
        })
        .attr("stroke-width", 2)
        .attr("stroke", "red");
});
