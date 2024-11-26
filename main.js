
let wordTreeString="", quantData= [], qualData = [], forx, allAdj =[], sentimentScore=[], score, i;
import { RiTa } from "https://esm.sh/rita";
import * as d3 from "https://cdn.skypack.dev/d3";
import Sentiment from "https://cdn.skypack.dev/sentiment";

const sentiment = new Sentiment();

// Function to calculate sentiment
function calculateSentiment(str) {
    const result = sentiment.analyze(str); // Use the instance to call 'analyze'

    const score = result.score;

    return score;
}







async function getData() {
    const response = await fetch("data/womenDressesReviewsDataset.csv");
    const csvData = await response.text();
    const data = d3.csvParse(csvData);
   
    return data;
}


getData().then(data => {
    preWordTree(data);
    preqvq(data);
    presun(data);
    prechart3(data);

    
});




//for qual vs quant chart I need the ratings, and the sentiment based on the adjectives.
function preqvq(data)
{
    for (let i = 0; i < data.length; i++) {
        
    
        // Store the rating value in quantData
        quantData[i] = data[i].rating;
    
        // Tokenize the review text using the global RiTa object
        const tokens = RiTa.tokenize(data[i].review_text);
        const adjectives = tokens.filter(token => RiTa.isAdjective(token));
        
        for(let j = 0; j < adjectives.length; j++){
           
            score = calculateSentiment(adjectives[j]);
            allAdj.push({ adjective: adjectives[j], sentiment_score: score, rating: data[i].rating });
            
         }

    }
    allAdj.sort((a, b) => a.sentiment_score - b.sentiment_score); 
    create_heatmap(allAdj);
    
}



function presun(data) {
    
    
    // First, use d3.group to group the data by division_name -> department_name -> class_name
    const nestedData = d3.group(data, d => d.division_name, d => d.department_name, d => d.class_name);
    
    // Now, we need to create the hierarchical structure for the sunburst chart
    const sunburstData = {
        name: "flare", // Root name
        children: [] // The top-level children array
    };

    // Loop through each division, department, and class to create the tree structure
    nestedData.forEach((departmentGroups, divisionName) => {
        const divisionNode = {
            name: divisionName,
            children: [] // Array to hold departments
        };

        departmentGroups.forEach((classGroups, departmentName) => {
            const departmentNode = {
                name: departmentName,
                children: [] // Array to hold classes
            };

            classGroups.forEach((reviews, className) => {
                const classNode = {
                    name: className,
                    children: [] // Array to hold reviews
                };

                // For each review, add a child node
                reviews.forEach(review => {
                    classNode.children.push({ name: review.review_text });
                });

                // Push the class node into the department's children
                departmentNode.children.push(classNode);
            });

            // Push the department node into the division's children
            divisionNode.children.push(departmentNode);
        });

        // Push the division node into the sunburst data's children
        sunburstData.children.push(divisionNode);
    });

    // console.log(sunburstData);
    drawSunburst(sunburstData);
}





//to create chart 4 I need the count of all grouped class_names which are recommended and not recommended, so that is first group by recommended, then group by class. also need the age of each 
function prechart3(data)
{
    
    const nestedData = d3.group(data, d => d.recommend_index, d => d.class_name);
   
    //need this in a format where it's an array of objects, each object has the class_name, whether recommended or not, and the age of that reviewer
    const chart4Data = [[], []];
    nestedData.forEach((classGroups, recommendIndex) => {
        classGroups.forEach((reviews, className) => {
            reviews.forEach(review => {
                chart4Data[recommendIndex].push({ class_name: className, recommended: recommendIndex, age: review.age });
            });
        });
    });

    createBarChart(chart4Data);

}

function createBarChart(data) {
    const width = 800;
    const height = 600;
    const margin = { top: 20, right: 20, bottom: 50, left: 50 };

    const svg = d3.select("#chart3")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    const chartGroup = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Define scales
    const x = d3.scaleBand()
        .range([0, width - margin.left - margin.right])
        .padding(0.1);

    const y = d3.scaleLinear()
        .range([height - margin.top - margin.bottom, 0]);

    // Axes groups
    const xAxisGroup = chartGroup.append("g");
    const yAxisGroup = chartGroup.append("g");

    // Collect all unique class_names for persistent x-axis labels
    const allClassNames = new Set(data.flatMap(dataset => dataset.map(d => d.class_name)));

    // Update function to filter and redraw the bar chart
    function updateChart(minAge, maxAge) {
        // Filter data by age
        const filteredData = data.map(dataset =>
            dataset.filter(d => +d.age >= minAge && +d.age <= maxAge)
        );

        // Compute counts for recommended and not-recommended for each class_name
        const groupedData = {};
        allClassNames.forEach(className => {
            groupedData[className] = {
                notRecommended: filteredData[0].filter(d => d.class_name === className).length,
                recommended: filteredData[1].filter(d => d.class_name === className).length,
            };
        });

        // Transform grouped data into an array
        const chartData = Array.from(allClassNames).map(className => ({
            class_name: className,
            notRecommended: groupedData[className].notRecommended,
            recommended: groupedData[className].recommended,
        }));

        // Update scales
        x.domain(Array.from(allClassNames));
        y.domain([
            -d3.max(chartData, d => d.notRecommended), // Negative domain for not-recommended
            d3.max(chartData, d => d.recommended),     // Positive domain for recommended
        ]);

        // Update x-axis position and labels
        xAxisGroup
            .attr("transform", `translate(0, ${y(0)})`) // Move x-axis to y=0
            .call(d3.axisBottom(x))
            .selectAll("text")
            .style("font-size", "12px");

        // Update y-axis
        yAxisGroup.call(d3.axisLeft(y));

        // Bind data to bars
        const bars = chartGroup.selectAll(".bar-group")
            .data(chartData, d => d.class_name);

        // Enter new bar groups
        const barGroups = bars.enter()
            .append("g")
            .attr("class", "bar-group");

        // Add recommended bars (positive, above x-axis)
        barGroups.append("rect")
            .attr("class", "bar recommended")
            .attr("x", d => x(d.class_name))
            .attr("y", d => y(d.recommended))
            .attr("width", x.bandwidth())
            .attr("height", d => y(0) - y(d.recommended)) // Height from 0 to positive value
            .attr("fill", "green");

        // Add not-recommended bars (negative, below x-axis)
        barGroups.append("rect")
            .attr("class", "bar not-recommended")
            .attr("x", d => x(d.class_name))
            .attr("y", d => y(0)) // Start at x-axis (y=0)
            .attr("width", x.bandwidth())
            .attr("height", d => y(-d.notRecommended) - y(0)) // Height from 0 to negative value
            .attr("fill", "red");

        // Update existing bars
        bars.select(".bar.recommended")
            .attr("x", d => x(d.class_name))
            .attr("y", d => y(d.recommended))
            .attr("width", x.bandwidth())
            .attr("height", d => y(0) - y(d.recommended));

        bars.select(".bar.not-recommended")
            .attr("x", d => x(d.class_name))
            .attr("y", d => y(0))
            .attr("width", x.bandwidth())
            .attr("height", d => y(-d.notRecommended) - y(0));

        // Remove old bars
        bars.exit().remove();
    }

    // Attach slider event
    const slider = d3.select("#ageRange");
    slider.on("input", function () {
        const ageValue = +this.value;
        d3.select("#ageValue").text(ageValue);
        updateChart(0, ageValue); // Adjust range as needed
    });

    // Initial render
    updateChart(0, +slider.property("value"));
}







function preWordTree(data) {
    // Efficiently calculate the 20 most common starting words
    const wordCounts = new Map();

    // Process each review
    data.forEach(review => {
        const sentences = RiTa.sentences(review.review_text);
        sentences.forEach(sentence => {
            const firstWord = RiTa.tokenize(sentence.toLowerCase())[0];
            if (firstWord) {
                wordCounts.set(firstWord, (wordCounts.get(firstWord) || 0) + 1);
            }
        });
    });

    // Get the top 20 starting words
    const topWords = Array.from(wordCounts.entries())
        .sort((a, b) => b[1] - a[1]) // Sort by frequency
        .slice(0, 20) // Take the top 20
        .map(d => d[0]);

    // Populate the dropdown menu
    const dropdown = d3.select("#dropdown");
    dropdown.selectAll("option").remove(); // Clear existing options
    topWords.forEach(word => {
        dropdown.append("option").text(word).attr("value", word);
    });

    // Build the word tree with the default keyword (first in dropdown)
    let selectedKeyword = topWords[0];
    buildAndDrawWordTree(data, selectedKeyword);

    // Update the tree when a new keyword is selected
    dropdown.on("change", function () {
        const selectedKeyword = this.value;
        buildAndDrawWordTree(data, selectedKeyword);
    });
}

function buildAndDrawWordTree(data, keyword) {
    const root = { name: keyword, children: [] };

    // Build the word tree with three levels initially
    const maxInitialDepth = 6;

    data.forEach(review => {
        const sentences = RiTa.sentences(review.review_text);
        sentences.forEach(sentence => {
            const words = RiTa.tokenize(sentence.toLowerCase());
            const index = words.indexOf(keyword.toLowerCase());
            if (index !== -1) {
                let currentNode = root;
                for (let i = index + 1; i < words.length && i < index + 1 + maxInitialDepth; i++) {
                    const word = words[i];
                    let childNode = currentNode.children.find(d => d.name === word);
                    if (!childNode) {
                        childNode = { name: word, children: [] };
                        currentNode.children.push(childNode);
                    }
                    currentNode = childNode;
                }
            }
        });
    });

    // Redraw the word tree
    drawWordTree(root, data);
}

function drawWordTree(data, fullData) {
    const width = 1920;
    const height = 1080;
    const margin = { top: 20, right: 120, bottom: 20, left: 120 };

    const treeLayout = d3.tree().size([height, width - 200]);

    const root = d3.hierarchy(data);
    treeLayout(root);

    // Remove existing SVG
    d3.select("#chart1svg").select("svg").remove();

    // Create an SVG element
    const svg = d3.select("#chart1svg")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Create links between nodes
    svg.selectAll(".link")
        .data(root.links())
        .enter()
        .append("line")
        .attr("class", "link")
        .attr("x1", d => d.source.y)
        .attr("y1", d => d.source.x)
        .attr("x2", d => d.target.y)
        .attr("y2", d => d.target.x)
        .attr("stroke", "#999");

    // Create nodes
    const nodes = svg.selectAll(".node")
        .data(root.descendants())
        .enter()
        .append("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${d.y},${d.x})`);

    nodes.append("circle")
        .attr("r", 5)
        .attr("fill", "#69b3a2")
        .on("click", (event, d) => expandNode(d, fullData));

    nodes.append("text")
        .attr("dy", 3)
        .attr("x", d => d.children ? -10 : 10)
        .style("text-anchor", d => d.children ? "end" : "start")
        .text(d => d.data.name);
}

function expandNode(node, fullData) {
    if (node.children && node.children.length > 0) {
        // Already expanded, collapse it
        node.children = [];
    } else {
        // Lazy-load children
        const keyword = node.data.name;
        const newChildren = [];
        const maxNewNodes = 10;

        fullData.forEach(review => {
            const sentences = RiTa.sentences(review.review_text);
            sentences.forEach(sentence => {
                const words = RiTa.tokenize(sentence.toLowerCase());
                const index = words.indexOf(keyword.toLowerCase());
                if (index !== -1) {
                    let currentNode = { name: keyword, children: [] };
                    let wordCounter = 0;

                    // Add up to 10 new nodes (or until the end of the sentence)
                    for (let i = index + 1; i < words.length && wordCounter < maxNewNodes; i++) {
                        const word = words[i];
                        let childNode = currentNode.children.find(d => d.name === word);
                        if (!childNode) {
                            childNode = { name: word, children: [] };
                            currentNode.children.push(childNode);
                            wordCounter++; // Track added nodes
                        }
                        currentNode = childNode;
                    }

                    newChildren.push(...currentNode.children);
                }
            });
        });

        node.children = newChildren;
    }

    // Redraw tree with updated data
    drawWordTree(node.data, fullData);
}







function drawSunburst(data) {
    const width = 928;
    const height = width;
    const radius = width / 6;

    // Create the color scale.
    const color = d3.scaleOrdinal(d3.quantize(d3.interpolateRainbow, data.children.length + 1));

    // Compute the layout.
    const hierarchy = d3.hierarchy(data)
        .sum(d => d.children ? d.children.length : 1) // Use number of children as value
        .sort((a, b) => b.value - a.value);

    const root = d3.partition()
        .size([2 * Math.PI, hierarchy.height + 1])(hierarchy);
    root.each(d => d.current = d);

    // Create the arc generator.
    const arc = d3.arc()
        .startAngle(d => d.x0)
        .endAngle(d => d.x1)
        .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
        .padRadius(radius * 1.5)
        .innerRadius(d => d.y0 * radius)
        .outerRadius(d => Math.max(d.y0 * radius, d.y1 * radius - 1));

    // Create the SVG container.
    const svg = d3.select("body") // Change to a specific container like "#chart" if needed
        .append("svg")
        .attr("viewBox", [-width / 2, -height / 2, width, width])
        .style("font", "10px sans-serif");

    // Create a tooltip div (hidden by default).
    const tooltip = d3.select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("background", "rgba(0, 0, 0, 0.7)")
        .style("color", "white")
        .style("padding", "8px")
        .style("border-radius", "4px")
        .style("pointer-events", "none")
        .style("display", "none");

    // Append the arcs.
    const path = svg.append("g")
        .selectAll("path")
        .data(root.descendants().slice(1)) // Skip the root node
        .join("path")
        .attr("fill", d => { while (d.depth > 1) d = d.parent; return color(d.data.name); })
        .attr("fill-opacity", d => arcVisible(d.current) ? (d.children ? 0.6 : 0.4) : 0)
        .attr("pointer-events", d => arcVisible(d.current) ? "auto" : "none")
        .attr("d", d => arc(d.current));

    // Add tooltips for review nodes.
    path.filter(d => !d.children) // Only for leaf nodes (reviews)
        .on("mouseover", (event, d) => {
            tooltip.style("display", "block")
                .html(d.data.name); // Display the review text
        })
        .on("mousemove", event => {
            tooltip.style("top", (event.pageY + 10) + "px")
                .style("left", (event.pageX + 10) + "px");
        })
        .on("mouseout", () => {
            tooltip.style("display", "none");
        });

    // Add interactivity (click to zoom).
    path.filter(d => d.children)
        .style("cursor", "pointer")
        .on("click", clicked);

    const label = svg.append("g")
        .attr("pointer-events", "none")
        .attr("text-anchor", "middle")
        .style("user-select", "none")
        .selectAll("text")
        .data(root.descendants().slice(1))
        .join("text")
        .attr("dy", "0.35em")
        .attr("fill-opacity", d => +labelVisible(d.current))
        .attr("transform", d => labelTransform(d.current))
        .text(d => d.data.name);

    const parent = svg.append("circle")
        .datum(root)
        .attr("r", radius)
        .attr("fill", "none")
        .attr("pointer-events", "all")
        .on("click", clicked);

    function clicked(event, p) {
        parent.datum(p.parent || root);

        root.each(d => d.target = {
            x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
            x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
            y0: Math.max(0, d.y0 - p.depth),
            y1: Math.max(0, d.y1 - p.depth)
        });

        const t = svg.transition().duration(750);

        // Transition the data on all arcs, even the ones that aren’t visible.
        path.transition(t)
            .tween("data", d => {
                const i = d3.interpolate(d.current, d.target);
                return t => d.current = i(t);
            })
            .filter(function (d) {
                return +this.getAttribute("fill-opacity") || arcVisible(d.target);
            })
            .attr("fill-opacity", d => arcVisible(d.target) ? (d.children ? 0.6 : 0.4) : 0)
            .attr("pointer-events", d => arcVisible(d.target) ? "auto" : "none")
            .attrTween("d", d => () => arc(d.current));

        label.filter(function (d) {
            return +this.getAttribute("fill-opacity") || labelVisible(d.target);
        }).transition(t)
            .attr("fill-opacity", d => +labelVisible(d.target))
            .attrTween("transform", d => () => labelTransform(d.current));
    }

    function arcVisible(d) {
        return d.y1 <= 3 && d.y0 >= 1 && d.x1 > d.x0;
    }

    function labelVisible(d) {
        return d.y1 <= 3 && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.03;
    }

    function labelTransform(d) {
        const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
        const y = (d.y0 + d.y1) / 2 * radius;
        return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
    }
}






function create_heatmap(data) {
    console.log(data);

    const width = 1920;
    const height = 1080;
    const margin = { top: 50, right: 20, bottom: 50, left: 150 };

    const svgContainer = d3.select("#chart2svg");
    const color = d3.scaleSequential()
        .domain([0, 2000, 4000, 8000]) // Set the domain for counts
        .range(["yellow", "purple"]);

    let currentView = "macro"; // Default view

    // Create a tooltip element
    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("background", "rgba(0, 0, 0, 0.7)")
        .style("color", "white")
        .style("padding", "5px 10px")
        .style("border-radius", "5px")
        .style("pointer-events", "none")
        .style("opacity", 0);

    function drawChart(view) {
        svgContainer.selectAll("*").remove(); // Clear existing content

        // Process data based on view type
        let yDomain, flattenedData;

        if (view === "macro") {
            // MACRO VIEW: Adjectives sorted by sentiment score
            yDomain = Array.from(new Set(data))
                .sort((a, b) => a.sentiment_score - b.sentiment_score)
                .map(d => d.adjective);

            // Aggregate data as in original function
            const aggregatedData = d3.rollup(
                data,
                group => group.length, // Count occurrences
                d => +d.rating,        // Group by numeric rating
                d => d.adjective       // Then by adjective
            );

            flattenedData = [];
            for (const [rating, adjectives] of aggregatedData.entries()) {
                for (const [adjective, count] of adjectives.entries()) {
                    flattenedData.push({ rating, adjective, count });
                }
            }
        } else {
            // MICRO VIEW: Group adjectives by sentiment bins
            const sentimentBins = d3.range(-5, 6); // Sentiment bins -5 to +5

            // Group adjectives into bins
            const binnedData = d3.rollup(
                data,
                group => group.length, // Count occurrences
                d => +d.rating,        // Group by numeric rating
                d => Math.floor(d.sentiment_score) // Group by sentiment bin
            );

            flattenedData = [];
            for (const [rating, bins] of binnedData.entries()) {
                for (const [bin, count] of bins.entries()) {
                    flattenedData.push({ rating, bin, count });
                }
            }

            yDomain = sentimentBins.map(bin => `Sentiment ${bin}`);
        }

        // Define scales
        const x = d3.scaleBand()
            .domain([1, 2, 3, 4, 5]) // Ratings 1 to 5
            .range([margin.left, width - margin.right])
            .padding(0.1);

        const y = d3.scaleBand()
            .domain(yDomain)
            .range([margin.top, height - margin.bottom])
            .padding(0.1);

        // Draw heatmap rectangles
        svgContainer.selectAll("rect")
            .data(flattenedData)
            .enter()
            .append("rect")
            .attr("x", d => x(d.rating))
            .attr("y", d => y(view === "macro" ? d.adjective : `Sentiment ${d.bin}`))
            .attr("width", x.bandwidth())
            .attr("height", y.bandwidth())
            .attr("fill", d => color(d.count))
            .on("mouseover", function (event, d) {
                if (view === "macro") {
                    tooltip.transition().duration(200).style("opacity", 1);
                    tooltip.html(`<strong>${d.adjective}</strong>`)
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 10) + "px");
                }
            })
            .on("mousemove", function (event) {
                tooltip.style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 10) + "px");
            })
            .on("mouseout", function () {
                tooltip.transition().duration(200).style("opacity", 0);
            });

        // Add X-axis
        svgContainer.append("g")
            .attr("transform", `translate(0,${margin.top})`)
            .call(d3.axisTop(x).ticks(5))
            .selectAll("text")
            .style("font-size", "12px");

        // Add Y-axis
        svgContainer.append("g")
            .attr("transform", `translate(${margin.left},0)`)
            .call(d3.axisLeft(y))
            .selectAll("text")
            .style("font-size", "12px");
    }

    // Initialize with macro view
    drawChart(currentView);

    // Add button listener for toggling views
    d3.select("#toggleView").on("click", () => {
        currentView = currentView === "macro" ? "micro" : "macro";
        drawChart(currentView);
    });
}






