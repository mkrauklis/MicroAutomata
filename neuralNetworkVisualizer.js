function nnVizPrintNNNeuralNetwork(nn, x, y, width, height) {
    // Determine the grid size by getting the widest layer node count and the total number of layers
    let gridHeight = 0
    for (let i = 0; i < nn.layers.length; i++) {
        gridHeight = max(gridHeight, nn.layers[i].neurons.length)
    }
    let gridWidth = nn.layers.length

    // Our grid is going to be a rectangle of width widestLayer and height gridHeight
    let cellWidth = width / gridWidth
    let cellHeight = height / gridHeight

    // Calculate the y-offset for each layer so they are centered
    let yOffsetsForLayers = []
    for (let i = 0; i < nn.layers.length; i++) {
        yOffsetsForLayers.push((gridHeight - nn.layers[i].neurons.length) / 2 * cellHeight)
    }

    // Make the node width 1/2 the size of either the cellWidth or cellHeight, which ever is smaller
    let nodeSize = max(min(cellWidth, cellHeight) / 2, 1)

    // Draw the edges first, starting at the second to left most layer and working to the left
    // Each layer references the previous layer as inputs so don't draw edges for the first layer
    // The color of each edge should be black-to-light-gray based on the weight
    for (let i = 1; i < nn.layers.length; i++) {
        for (let j = 0; j < nn.layers[i].neurons.length; j++) {
            for (let k = 0; k < nn.layers[i - 1].neurons.length; k++) {
                let y1offset = yOffsetsForLayers[i - 1]
                let y2offset = yOffsetsForLayers[i]
                // Draw the edge
                colorComponent = 100 * (nn.layers[i].neurons[j].weights[k] + 1);
                stroke(color(colorComponent, colorComponent, colorComponent))
                strokeWeight(1)
                // Draw the line, taking into account the y-offsets
                line(x + ((i - 1) * cellWidth) + (cellWidth / 2), y + (k * cellHeight) + (cellHeight / 2) + y1offset, x + (i * cellWidth) + (cellWidth / 2), y + (j * cellHeight) + (cellHeight / 2) + y2offset)
            }
        }
    }

    // Draw the nodes, working left to right and top to bottom, starting at the first layer and working to the right
    // The color of each node should be black-to-light-gray based on the bias
    for (let i = 0; i < nn.layers.length; i++) {
        for (let j = 0; j < nn.layers[i].neurons.length; j++) {
            let yoffset = yOffsetsForLayers[i]
            colorComponent = 100 * (nn.layers[i].neurons[j].bias + 1);
            fill(color(colorComponent, colorComponent, colorComponent))
            stroke('black')
            strokeWeight(1)
            circle(x + (i * cellWidth) + (cellWidth / 2), y + (j * cellHeight) + (cellHeight / 2) + yoffset, nodeSize)
        }
    }
}

// Neural Network history tracking
let nnVizNNHistoryTicks = -1
let nnVizNNHistory = {}
let nnVizNNHistoryGranularity = 20
function nnVizUpdateNNHistory() {
    nnVizNNHistoryTicks++

    if (nnVizNNHistoryTicks % nnVizNNHistoryGranularity != 0) {
        return;
    }

    let nnHistoryAtTick = {}
    for (var col = 0; col < gridColRows.length; col++) {
        for (var row = 0; row < gridColRows[col].length; row++) {
            if (gridColRows[col][row].bacterialnn) {
                nnID = gridColRows[col][row].bacterialnn.nn.id

                // Add lineage to id separated by ->
                for (var i = 0; i < gridColRows[col][row].bacterialnn.nn.lineage.length; i++) {
                    nnID += '->' + gridColRows[col][row].bacterialnn.nn.lineage[i]
                }

                if (!nnHistoryAtTick[nnID]) {
                    nnHistoryAtTick[nnID] = 1
                }
                else {
                    nnHistoryAtTick[nnID] += 1
                }
            }
        }
    }
    nnVizNNHistory[nnVizNNHistoryTicks] = nnHistoryAtTick

    // Remove any keys that have a value of 1
    for (var key in nnHistoryAtTick) {
        if (nnHistoryAtTick[key] == 1) {
            delete nnHistoryAtTick[key]
        }
    }
}

/**
 * Draw the Neural Network History Graph
 */
function nnVizDrawNNHistoryGraph(plotID) {
    let data = nnVizNNHistory
    let df = []
    for (var tick in data) {
        for (var nnid in data[tick]) {
            df.push({ 'tick': tick, 'neural_net_id': nnid, 'count': data[tick][nnid] })
        }
    }

    // We have a DF that is an an array of objects with tick, neural_net_id, and count

    // Plotly Plot the neural_net_id vs tick in a stacked area chart
    // tick is the x axis
    // count is the y axis
    // neural_net_id is the stack

    // Pivot the data to an array of objects where ticks are the x axis, y axis is the count, and the stackgroup is the neural_net_id
    // Iterate over each distinct neural_net_id and create a trace for each
    let traces = []
    let neural_net_ids = [...new Set(df.map(x => x.neural_net_id))]
    for (var i = 0; i < neural_net_ids.length; i++) {
        let neural_net_id = neural_net_ids[i]
        let trace = {
            x: df.filter(x => x.neural_net_id == neural_net_id).map(x => x.tick),
            y: df.filter(x => x.neural_net_id == neural_net_id).map(x => x.count),
            stackgroup: 'one',
            name: neural_net_id,
            mode: 'lines',
            line: { width: 0.5 },
            fill: 'tonexty'
        }
        traces.push(trace)
    }

    // Draw the lines as a spline
    let layout = {
        title: 'Neural Net History',
        xaxis: {
            title: 'Tick'
        },
        yaxis: {
            title: 'Count'
        },
        showlegend: true
    }

    Plotly.newPlot(plotID, traces, layout)
}