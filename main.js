
let wordTreeString="", quantData= [], qualData = [], forx, allAdj =[], sentimentScore=[], score, i;
import { RiTa } from "https://esm.sh/rita";
import * as d3 from "https://cdn.skypack.dev/d3";
import Sentiment from "https://cdn.skypack.dev/sentiment";

const sentiment = new Sentiment();


let colours = { primary: "#ffed85", secondary: "#fb6d51", tertiary: "#a3f59d", quaternary: "#FFFFFF", quinary: "#8A3B76", text: "#FFFFFF", tooltipText: "#FFFFFF", background: "#403D39", stroke: "#FFFFFF" };

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
    // preWordTree(data);
    // preqvq(data);
    // presun(data);
    prechart3(data);

    
});





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
    const height = 1000;
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
        y.domain([0, d3.max(chartData, d => d.recommended + d.notRecommended)]);  // Max value for stacked chart

        // Update x-axis position and labels
        xAxisGroup
            .attr("transform", `translate(0, ${y(0)})`) // Move x-axis to y=0
            .call(d3.axisBottom(x))
            .selectAll("text")
            .style("font-size", "12px");

        // Update y-axis
        yAxisGroup.call(d3.axisLeft(y));

        // Stack the data
        const stack = d3.stack()
            .keys(["notRecommended", "recommended"]);

        const stackedData = stack(chartData);

        // Bind data to bars
        const bars = chartGroup.selectAll(".bar-group")
            .data(stackedData, d => d.key);

        // Enter new bar groups
        const barGroups = bars.enter()
            .append("g")
            .attr("class", "bar-group");

        // Add stacked bars (both recommended and not-recommended stacked)
        barGroups.selectAll("rect")
            .data(d => d) // Get the data for the individual bars
            .enter()
            .append("rect")
            .attr("class", d => `bar ${d.data.class_name}`)
            .attr("x", d => x(d.data.class_name))
            .attr("y", d => y(d[1])) // Stack position based on the y scale
            .attr("width", x.bandwidth())
            .attr("height", d => y(d[0]) - y(d[1])) // Height is the difference between the stacked values
            .attr("fill", (data, i) => {
                if (i === 0) {
                    return colours.secondary; // Set color to secondary for notRecommended
                } else if (i === 1) {
                    return colours.primary; // Set color to primary for recommended
                } else {
                    return null; // Set color to null for other elements
                }
            });

        // Update existing bars (if any)
        bars.selectAll("rect")
            .data(d => d)
            .attr("x", d => x(d.data.class_name))
            .attr("y", d => y(d[1]))
            .attr("width", x.bandwidth())
            .attr("height", d => y(d[0]) - y(d[1]))
            .attr("fill", (d, i) => i === 0 ? colours.secondary : colours.primary); // Ensure colors are set correctly

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
    // Calculate divisiveness score for each review
    const scoredData = data.map(review => {
        const sentences = RiTa.sentences(review.review_text);
        const uniqueFirstWords = new Set();

        sentences.forEach(sentence => {
            const firstWord = RiTa.tokenize(sentence.toLowerCase())[0];
            if (firstWord) {
                uniqueFirstWords.add(firstWord);
            }
        });

        // Divisiveness score: number of unique first words divided by total sentences
        const divisiveness = uniqueFirstWords.size / sentences.length;
        return { review, divisiveness };
    });

    // Sort reviews by divisiveness in descending order and select the top 100
    const limitedData = scoredData
        .sort((a, b) => b.divisiveness - a.divisiveness)
        .slice(0, 100)
        .map(d => d.review);

    // Efficiently calculate the 20 most common starting words
    const wordCounts = new Map();

    // Process each review
    limitedData.forEach(review => {
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
    buildAndDrawWordTree(limitedData, selectedKeyword);

    // Update the tree when a new keyword is selected
    dropdown.on("change", function () {
        const selectedKeyword = this.value;
        buildAndDrawWordTree(limitedData, selectedKeyword);
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
    const width = 1500;
    const height = 1300;
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

    // Create a tooltip div (hidden by default)
    const tooltip = d3.select("#chart1svg")
        .append("div")
        .style("position", "absolute")
        .style("background", "#fff")
        .style("border", "1px solid #ccc")
        .style("padding", "5px")
        .style("border-radius", "3px")
        .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)")
        .style("pointer-events", "none")
        .style("opacity", 0);

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
        .attr("stroke", colours.stroke);

    // Create nodes
    const nodes = svg.selectAll(".node")
        .data(root.descendants())
        .enter()
        .append("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${d.y},${d.x})`);

    nodes.append("circle")
        .attr("r", 5)
        .attr("fill", colours.primary)
        .on("mouseover", (event, d) => {
            tooltip
                .style("opacity", 1)
                .html(`<strong>${d.data.name}</strong>`) // Tooltip content
                .style("left", `${event.pageX + 10}px`)
                .style("top", `${event.pageY + 10}px`);
        })
        .on("mouseout", () => {
            tooltip.style("opacity", 0);
        })
        .on("click", (event, d) => expandNode(d, fullData));

    nodes.append("text")
        .attr("dy", 3)
        .attr("x", d => d.children ? -10 : 10)
        .style("text-anchor", d => d.children ? "end" : "start")
        .text(d => d.data.name)
        .style("font-size", "12px") // Reduce text size for crowded nodes
        .style("pointer-events", "none") // Ensure text doesn't block interaction
        .style("fill", colours.text);
}


function expandNode(node, fullData) {
    if (node._children && node._children.length > 0) {
        // Collapse already expanded nodes
        node.children = node._children;
        node._children = null;
    } else {
        // Expand node by adding new children
        const keyword = node.data.name;
        const newChildren = [];
        const maxNewNodes = 6; // Limit to avoid overload

        fullData.forEach(review => {
            const sentences = RiTa.sentences(review.review_text);
            sentences.forEach(sentence => {
                const words = RiTa.tokenize(sentence.toLowerCase());
                const index = words.indexOf(keyword.toLowerCase());
                if (index !== -1) {
                    let currentNode = { name: keyword, children: [] };
                    let wordCounter = 0;

                    // Add new nodes following the keyword in the sentence
                    for (let i = index + 1; i < words.length && wordCounter < maxNewNodes; i++) {
                        const word = words[i];
                        let childNode = currentNode.children.find(d => d.name === word);
                        if (!childNode) {
                            childNode = { name: word, children: [] };
                            currentNode.children.push(childNode);
                            wordCounter++;
                        }
                        currentNode = childNode;
                    }

                    newChildren.push(...currentNode.children);
                }
            });
        });

        // Save current children for toggling collapse
        node._children = newChildren.length > 0 ? newChildren : node.children || [];
        node.children = node._children;
    }

    // Redraw tree with updated data
    drawWordTree(node.data, fullData);
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

function drawSunburst(data) {
    
    const width = 1000;
    const height = width;
    const radius = width / 6;
    // Create the color scale.
    const color = d3.scaleOrdinal()
        .domain(data.children.map(d => d.name))
        .range(Object.values(colours));

    // Compute the layout.
    const hierarchy = d3.hierarchy(data)
        .sum(d =>  d.children ? d.children.length: 360) // Use number of children as value
        .sort((a, b) => b.value - a.value)
        

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
    const svg = d3.select("#chart4svg")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [-width / 2, -height / 2, width, width])
        .style("font", "14px, sans-serif")
        .style('color', colours.text);
  

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
        .style("display", "none")
        .style("width", "400px") // Set fixed width for tooltip
        .style("word-wrap", "break-word"); // Enable word wrap

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
                .style("left", (event.pageX + 10) + "px")
                .style("height", "auto"); // Reset height to auto

            const tooltipWidth = parseInt(tooltip.style("width")); // Get tooltip width
            const tooltipHeight = parseInt(tooltip.style("height")); // Get tooltip height

            // Check if the tooltip exceeds the window width
            if (event.pageX + tooltipWidth > window.innerWidth) {
                tooltip.style("left", (event.pageX - tooltipWidth - 10) + "px");
            }

            // Check if the tooltip exceeds the window height
            if (event.pageY + tooltipHeight > window.innerHeight) {
                tooltip.style("top", (event.pageY - tooltipHeight - 10) + "px");
            }
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
    

    const width = 1500;
    const height = 1000;
    const margin = { top: 50, right: 20, bottom: 50, left: 150 };

    const svgContainer = d3.select("#chart2svg");
    const color = d3.scaleSequential()
        .domain([0, 8000]) // Set the domain for counts
        .interpolator(d3.interpolate(colours.primary, colours.secondary));

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
        .style("opacity", 0)
        .style("width", "100px")  // Set the width to 100px
        .style("word-wrap", "break-word")  // Ensure text wraps inside the box
        .style("white-space", "normal"); // Allow the text to break into multiple lines

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
        } 
        
        else {
            console.log("we're here")
            console.log(data)
            // MICRO VIEW: Group adjectives by sentiment bins
            const sentimentBins = d3.range(-3, 6); // Sentiment bins -3 to +5

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
                    // Find the original data item associated with the adjective
                    const dataItem = data.find(item => item.adjective === d.adjective);

                    // Highlight the hovered word across all ratings
                    svgContainer.selectAll("rect")
                        .transition()
                        .duration(200)
                        .style("opacity", other => (other.adjective === d.adjective ? 1 : 0.1));

                    // Show tooltip
                    tooltip.transition().duration(200).style("opacity", 1);
                    tooltip.html(`<strong>${"Word: " + d.adjective + ", Sentiment Score: " + (dataItem ? dataItem.sentiment_score : 'N/A') + ", Rating: " + d.rating}</strong>`)
                        .style("left", (event.pageX + 20) + "px")
                        .style("top", (event.pageY + 50) + "px");
                }
            })
            .on("mousemove", function (event) {
                tooltip.style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 10) + "px");
            })
            .on("mouseout", function () {
                if (view === "macro") {
                    // Reset the opacity of all rectangles
                    svgContainer.selectAll("rect")
                        .transition()
                        .duration(200)
                        .style("opacity", 1);

                    // Hide tooltip
                    tooltip.transition().duration(200).style("opacity", 0);
                }
            });

        // Add X-axis
        svgContainer.append("g")
            .attr("transform", `translate(0,${margin.top})`)
            .call(d3.axisTop(x).ticks(5))
            .selectAll("text")
            .style("font-size", "14px")
            .style("stroke", colours.stroke) // Apply stroke to the text
            .style("text-anchor", "middle")
            .style("font-family", "fractul-variable")
            .style("font-weight", "400");

        // Apply stroke to the axis line (path)
        svgContainer.selectAll(".domain")
            .style("stroke", colours.stroke); // Apply stroke color to the X-axis line


        svgContainer.append("text") // X-axis label
            .attr("x", (width - margin.left - margin.right) / 2 + margin.left) // Centered horizontally
            .attr("y", margin.top - 30) // Position above the axis
            .style("text-anchor", "middle")
            .style("font-size", "18px")
            .style("font-family", "open-sans, sans-serif")
            .style("font-weight", "600")
            .style("fill", colours.stroke)
            .text("Rating for the review that the adjective was used in.");

        // Add Y-axis
        const yAxis = svgContainer.append("g")
            .attr("transform", `translate(${margin.left},0)`);

        // Render the Y-axis differently based on the view
        if (view === "macro") {
            // In macro view, do not render Y-axis ticks
            yAxis.call(d3.axisLeft(y).tickFormat(() => "")); // Remove all labels

            // Apply stroke to the axis line (path), make it thinner or remove it entirely
            yAxis.selectAll(".domain")
                .style("stroke", "none") // Remove the stroke completely
                .style("stroke-width", 0); // Set stroke width to 0 (making it effectively invisible)
        } 
        else {
            yAxis.call(d3.axisLeft(y));
            // Apply stroke to the axis line (path)
            yAxis.selectAll(".domain")
                .style("stroke", colours.stroke); // Apply stroke color to the Y-axis line
        }

        // Style the axis ticks (if present)
        yAxis.selectAll("text")
            .style("font-size", "16px")
            .style("fill", colours.text) 
            .style("font-family", "fractul-variable")
            .style("font-weight", "400");

        // Add Y-axis label
        svgContainer.append("text")
            .attr("x", -((height - margin.top - margin.bottom) / 2) - margin.top) // Centered vertically
            .attr("y", margin.left - 40) // Position to the left of the axis
            .attr("transform", "rotate(-90)") // Rotate for vertical text
            .style("text-anchor", "middle")
            .style("font-size", "18px")
            .style("font-family", "open-sans, sans-serif")
            .style("font-weight", "600")
            .style("fill", colours.stroke)
            .text(view === "macro" ? "Adjectives (hover over the chart to see the names)" : "");

        svgContainer.selectAll(".tick line") // For X-axis
            .style("stroke", colours.stroke);
        
        yAxis.selectAll(".tick line") // For Y-axis
            .style("stroke", colours.stroke);
    }

    // Initialize with macro view
    

    // Add button listener for toggling views
    d3.select("#toggleView").on("click", () => {
        currentView = currentView === "macro" ? "micro" : "macro";
        drawChart(currentView);
    });
    drawChart("macro")
    createLegend(width, color);
}


function createLegend(width, color) {
    // Define the width and height of the legend rectangle
    const legendWidth = 20;  // Narrow width for the vertical legend
    const legendHeight = 300; // Adjust height as needed
    const margin = { top: 20, right: 20, bottom: 50, left: 50 };

    // Create a new container for the legend
    const legendContainer = d3.select("#legend2"); 

    // Create a gradient for the vertical legend
    const gradient = legendContainer.append("defs")
        .append("linearGradient")
        .attr("id", "legendGradient")
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "0%")
        .attr("y2", "100%");

    const legendDomain = color.domain();
    gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", color(legendDomain[0]));
    gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", color(legendDomain[1]));

    // Draw the vertical gradient rectangle
    legendContainer.append("rect")
        .attr("x", width + 30)  // Position it next to your chart
        .attr("y", margin.top)  // Align with the top of your chart
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#legendGradient)");

    // Add title to the legend
    legendContainer.append("text")
        .attr("x", width + 30 + legendWidth / 2) // Position it in the middle of the legend
        .attr("y", margin.top - 10) // Adjust the y position as needed
        .attr("text-anchor", "middle")
        .style("font-size", "18px")
        .style("font-weight", "bold")
        .style("fill", "yellow") // Ensure text color is visible
        .text("Legend");

    // Create scale for the ticks along the gradient
    const legendScale = d3.scaleLinear()
        .domain(legendDomain)
        .range([0, legendHeight]);

    // Create ticks for the legend and add labels
    const ticks = legendScale.ticks(5);  // Adjust number of ticks as needed
    const tickContainer = legendContainer.append("g");

    ticks.forEach((tickValue, i) => {
        // Add tick lines
        tickContainer.append("line")
            .attr("x1", width + 20) // Align with the edge of the gradient
            .attr("x2", width + 40) // Extend tick lines to the right
            .attr("y1", legendScale(tickValue))
            .attr("y2", legendScale(tickValue))
            .style("stroke", "white")  // Use stroke color for the lines
            .style("stroke-width", 1);

        // Add tick labels
        tickContainer.append("text")
            .attr("x", width + 50) // Position labels to the right of the ticks
            .attr("y", legendScale(tickValue))
            .attr("dy", "0.3em")  // Slight vertical alignment adjustment
            .style("font-size", "12px")
            .style("font-family", "open-sans, sans-serif")
            .style("fill", "white") // Ensure text is visible
            .style("text-anchor", "start")
            .text(d3.format(".0f")(tickValue));  // Format as integer
    });
}




// function createLegend(width, color) {
//     // Define the width and height of the legend rectangle
//     const legendWidth = 200;
//     const legendHeight = 1000;
//     const margin = { top: 20, right: 20, bottom: 50, left: 50 };

//     // Create a new container for the legend
//     const legendContainer = d3.select("#legend2"); // Assuming you have an element with the id 'legendContainer'

//     // Draw the white rectangle
//         legendContainer.append("rect")
//             .attr("x", width + 20)  // Position it next to your chart
//             .attr("y", margin.top)  // Align with the top of your chart
//             .attr("width", legendWidth)
//             .attr("height", legendHeight)
            
//         // Add title to the legend
//         legendContainer.append("text")
//             .attr("x", width + 20 + legendWidth / 2) // Position it in the middle of the legend
//             .attr("y", margin.top + 20) // Adjust the y position as needed
//             .attr("text-anchor", "middle")
//             .style("font-size", "18px")
//             .style("font-weight", "bold")
//             .style("fill", colours.text)
//             .text("Legend");

        
// }





