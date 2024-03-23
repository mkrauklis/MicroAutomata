function requireScript(script) {
  $.ajax({
      url: script,
      dataType: "script",
      async: false,
      success: function () {
          console.log("Script loaded: " + script);
      },
      error: function () {
          throw new Error("Error loading script: " + script);
      }
  });
}
requireScript('neuralNetwork.js')

var canvasFooter = 300;
var canvasHeight;
var canvasWidth;
var cellSize = 20;
var theFrameRate = 100;
var cellStroke = 0.25;
var neuralNetDisplayHeight = 150;
var neuralNetDisplayWidth = 300;

// Game parameters
var foodGrowthRate = 0.14
var bacteriaEatingRate = 0.15
var bacteriaCostOfReproduction = 0.4
var bacteriaChanceOfReproduction = 0.5
var phageEatingRate = 0.2;
var phageSpreadThreshold = 0.9
var phageChanceOfSpread = 0.9
var seasonalVariation = 0.1
var seasonalDuration = 1000
var seasonalTicksPerFrame = 1

var seasonalTicker = 1

// gridColRows[COLS][ROWS]
var gridColRows = null;

var inputTypes = ['Food', 'Bacteria', 'Phage', 'Wall', 'None'];
var inputType = 1; // Default to Bacteria

var reproductionDirections = ['UpLeft', 'Up', 'UpRight', 'Left', 'Right', 'DownLeft', 'Down', 'DownRight']

let nnHistoryTicks = -1
let nnHistory = {}
let nnHistoryGranularity = 20
function updateNNHistory(){
  nnHistoryTicks++
  
  if(nnHistoryTicks % nnHistoryGranularity != 0){
    return;
  }
  
  let nnHistoryAtTick = {}
  for (var col = 0; col < gridColRows.length; col++) {
    for (var row = 0; row < gridColRows[col].length; row++) {
      if (gridColRows[col][row].bacterialnn) {
        nnID = gridColRows[col][row].bacterialnn.nn.id

        // Add lineage to id separated by .
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
  nnHistory[nnHistoryTicks] = nnHistoryAtTick

  // Remove any keys that have a value of 1
  for (var key in nnHistoryAtTick) {
    if (nnHistoryAtTick[key] == 1) {
      delete nnHistoryAtTick[key]
    }
  }

  if(nnHistoryTicks % 2000 == 0){
    // Print as json
    //print(JSON.stringify(nnHistory))
  }
  
  // Redraw the graph
  drawNNHistoryGraph()
}

class BacterialNN {
  // ## Neural Network Inputs ##
  // Food
  // Health
  // Is Infected
  // Number of Neighbors
  // Number of Infected Neighbors

  // ## Neural Network Outputs ##
  // Eating Rate
  // Cost of Reproduction
  // Chance of Reproduction
  // Should Kill to Reproduce

  // NN Topology, fully feed forward connected 5/7/7/3
  constructor(copyFrom, isReproduction = false) {
    this.topology = copyFrom ? copyFrom.topology : this.generateRandomBacterialTopology()
    this.nn = new NNetwork(this.topology, copyFrom ? copyFrom.nn : null, isReproduction)
  }

  generateRandomBacterialTopology(){
    // Always start with 5 and end with 4
    let topology = [5]

    let hiddenLayerCount = int(random(1,5))
    for (var i = 0; i < hiddenLayerCount; i++) {
      topology.push(int(random(3,10)))
    }

    topology.push(4)

    return topology
  }

  // Returns an array of 3 floats and a boolean representing the outputs of the NN
  executeNN(food, health, isInfected, numNeighborsDividedBy9, numInfectedNeighborsDividedBy9) {
    this.nn.layers[0].neurons[0].output = food
    this.nn.layers[0].neurons[1].output = health
    this.nn.layers[0].neurons[2].output = isInfected
    this.nn.layers[0].neurons[3].output = numNeighborsDividedBy9
    this.nn.layers[0].neurons[4].output = numInfectedNeighborsDividedBy9

    for (var i = 1; i < this.nn.layers.length; i++) {
      this.nn.layers[i].activate()
    }

    let outputLayerNeurons = this.nn.layers[this.nn.layers.length - 1].neurons

    return [outputLayerNeurons[0].outputToZeroOneRange(), outputLayerNeurons[1].outputToZeroOneRange(), outputLayerNeurons[2].outputToZeroOneRange(), outputLayerNeurons[3].output > 0.0]
  }
}

class State {
  update(food, bacteria, phage, wall, bacterialnn = null) {
    this.food = food
    this.bacteria = bacteria
    this.phage = phage
    this.wall = wall

    if (bacteria > 0) {
      this.bacterialnn = bacterialnn ? bacterialnn : new BacterialNN()
    }
    else {
      this.bacterialnn = null
    }
  }

  constructor(col, row) {
    this.col = col
    this.row = row

    // Initialize to food
    this.food = 1.0
    this.bacteria = 0.0
    this.phage = 0.0
    this.wall = 0.0

    this.neighborhood = null

    this.bacterialnn = null
  }

  cleannn() {
    if (this.bacteria == 0) {
      this.bacterialnn = null
    }
  }
}

function iterateState() {
  seasonalTicker += seasonalTicksPerFrame
  
  // Handle Seasons
  // var seasonalVariation = 0.1
  // var seasonalDuration = 1000
  // var seasonalTicksPerFrame = 1
  let localFoodGrowthRate = max(0,foodGrowthRate + (seasonalVariation*sin(2*PI*seasonalTicker/seasonalDuration)))
  
  for (var col = 0; col < gridColRows.length; col++) {
    for (var row = 0; row < gridColRows[col].length; row++) {
      cellToday = gridColRows[col][row];

      iterateStateCellsNeighborhood(cellToday, localFoodGrowthRate);
    }
  }

  updateNNHistory()
}

function getNeighborhood(col, row, gridColRows) {
  //print('getting neighborhood for '+col+','+row)
  col--;
  row--;
  if (col < 0) {
    col += gridColRows.length;
  }
  if (row < 0) {
    row += gridColRows[col].length;
  }

  neighborhood = new Array(3);

  // we now have the top left of the neighborhood
  // we do this so we can use simple modulo from left to right to get the wrapped cells
  // we want to create a 3x3 array of nodes representing the neighborhood
  for (var colOffset = 0; colOffset < 3; colOffset++) {
    neighborhood[colOffset] = new Array(3)
    for (var rowOffset = 0; rowOffset < 3; rowOffset++) {
      colPlusOffset = (col + colOffset) % gridColRows.length
      rowPlusOffset = (row + rowOffset) % gridColRows[col].length
      neighborhood[colOffset][rowOffset] = gridColRows[colPlusOffset][rowPlusOffset]
      //print('['+colPlusOffset+']['+rowPlusOffset+']')
    }
  }

  return neighborhood;
}

function countNeighbors(neighborhood) {
  count = 0;
  for (var i = 0; i < neighborhood.length; i++) {
    for (var j = 0; j < neighborhood[i].length; j++) {
      if (neighborhood[i][j].bacteria > 0.0) {
        count += 1
      }
    }
  }
  return count
}

function countInfectedNeighbors(neighborhood) {
  count = 0;
  for (var i = 0; i < neighborhood.length; i++) {
    for (var j = 0; j < neighborhood[i].length; j++) {
      if (neighborhood[i][j].phage > 0.0) {
        count += 1
      }
    }
  }
  return count
}

function iterateStateCellsNeighborhood(cell, foodGrowthRate) {
  if (cell.bacterialnn && !cell.bacterialnn) {
    print('Error: BacterialNN is not being copied correctly')
  }

  //// Handle Food
  // If there is no wall, increase food
  if (cell.food == 0.0 && cell.bacteria > 0.0) {
    // do nothing, the bacteria gobbled up all the food and we can't do anything until it dies
  }
  else if (cell.wall == 0.0) {
    cell.food = Math.min(1.0, cell.food + foodGrowthRate);
  }
  else {
    cell.food = 0.0;
  }

  //// Handle Bacteria
  if (cell.bacteria > 0.0) {
    // Eat
    bacterialNNOutputs = cell.bacterialnn.executeNN(cell.food, cell.bacteria, cell.phage, countNeighbors(cell.neighborhood) / 9.0, countInfectedNeighbors(cell.neighborhood) / 9.0)
    bacteriaEatingRate = bacterialNNOutputs[0]
    bacteriaCostOfReproduction = bacterialNNOutputs[1]
    bacteriaChanceOfReproduction = bacterialNNOutputs[2]
    bacteriaShouldKillToReproduce = bacterialNNOutputs[3]

    if (cell.food > 0.0) {
      cell.bacteria = Math.min(1.0, cell.bacteria + Math.min(cell.food, bacteriaEatingRate));
      cell.food = Math.max(0.0, cell.food - bacteriaEatingRate);
    }
    else {
      cell.bacteria = Math.max(0.0, cell.bacteria - bacteriaEatingRate);
    }

    // Reproduce... if you can afford it and you didn't just get reproduced
    if ((cell.bacteria > (2 * bacteriaCostOfReproduction)) & (random() < bacteriaChanceOfReproduction)) {
      // Attempt to reproduce in a random direction
      // reproductionDirections=['UpLeft','Up','UpRight','Left','Right','DownLeft','Down','DownRight']

      targetReproductionCell = null;

      switch (random(reproductionDirections)) {
        case 'UpLeft':
          targetReproductionCell = cell.neighborhood[0][0];
          break;
        case 'Up':
          targetReproductionCell = cell.neighborhood[1][0];
          break;
        case 'UpRight':
          targetReproductionCell = cell.neighborhood[2][0];
          break;
        case 'Left':
          targetReproductionCell = cell.neighborhood[0][1];
          break;
        case 'Right':
          targetReproductionCell = cell.neighborhood[2][1];
          break;
        case 'DownLeft':
          targetReproductionCell = cell.neighborhood[0][2];
          break;
        case 'Down':
          targetReproductionCell = cell.neighborhood[1][2];
          break;
        case 'DownRight':
          targetReproductionCell = cell.neighborhood[2][2];
          break;
        default:
          alert('This should never happen!!')
      }

      if (targetReproductionCell.wall == 0.0 && 
        (targetReproductionCell.bacteria == 0.0 || bacteriaShouldKillToReproduce)) {
        // just setting both for simplicity
        targetReproductionCell.bacteria = bacteriaCostOfReproduction
        targetReproductionCell.bacterialnn = new BacterialNN(cell.bacterialnn, true)
      }
    }
  }

  //// Handle Phage
  if (cell.phage > 0) {
    // Eat
    if (cell.bacteria > 0.0) {
      cell.phage = Math.min(1.0, cell.phage + Math.min(cell.bacteria, phageEatingRate));
      cell.bacteria = Math.max(0.0, cell.bacteria - phageEatingRate);
    }
    else {
      cell.phage = Math.max(0.0, cell.phage - phageEatingRate);
    }

    // Reproduce
    if (cell.phage > phageSpreadThreshold && cell.bacteria > 0.0) {
      for (var i = 0; i < cell.neighborhood.length; i++) {
        for (var j = 0; j < cell.neighborhood[i].length; j++) {
          if (cell.neighborhood[i][j].wall == 0.0 && random() < phageChanceOfSpread) {
            cell.neighborhood[i][j].phage = Math.min(1.0, phageEatingRate * 2);
          }
        }
      }
      cell.phage = Math.min(1.0, phageEatingRate * 2);
      cell.bacteria = 0.0;
    }
  }
  else {
    cell.phage = 0;
  }

  // Cleanup bacterial nn
  cell.cleannn()
}

function mouseDragged() {
  handleMouseXY()
}

function mouseClicked() {
  handleMouseXY();
  printCell(findCellFromXY(mouseX, mouseY, gridColRows));
}

function handleMouseXY() {
  if (mouseY < canvasHeight) {
    updateCellForInput(findCellFromXY(mouseX, mouseY, gridColRows));
  } else if (mouseY < canvasHeight + 17) {
    inputType = (inputType + 1) % inputTypes.length;
  }
}

function printCell(cell) {
  if (cell) print('cell(col:' + cell.col + ', row:' + cell.row + ', ' + cell.food + ',' + cell.bacteria + ',' + cell.phage + ',' + cell.wall + ')');
}

function updateCellForInput(cell) {
  if (cell) {
    // 'Food','Bacteria','Phage','Wall'
    if (inputType == 0) {
      cell.update(1.0, 0.0, 0.0, 0.0)
    } else if (inputType == 1) {
      cell.update(cell.food, 1.0, 0.0, 0.0)
    } else if (inputType == 2) {
      cell.update(cell.food, cell.bacteria, 1.0, 0.0)
    } else if (inputType == 3) {
      cell.update(0.0, 0.0, 0.0, 1.0)
    }
  }
}

function mouseWheel(event) {
  if (event.delta > 0) {
    inputType = (inputType + 1) % 4
  }
  else {
    inputType = (inputType + 3) % 4
  }
}

function findCellFromXY(x, y, grid) {
  try{
    if (x >= 0 && y >= 0) {
      if (x < canvasWidth && y < canvasHeight) {
        return gridColRows[int(x / cellSize)][int(y / cellSize)];
      }
    }
  }
  catch(err){
    print('Warning from findCellFromXY: ' + err)
  }
  return null;
}

function secondarySetup(){
  canvasHeight = windowHeight - canvasFooter;
  canvasWidth = windowWidth;
  cols = int(canvasWidth / cellSize);
  rows = int(canvasHeight / cellSize);
  gridColRows = new Array(cols)

  for (var col = 0; col < cols; col++) {
    gridColRows[col] = new Array(rows);
    for (var row = 0; row < rows; row++) {
      gridColRows[col][row] = new State(col, row);
    }
  }
  for (var col = 0; col < cols; col++) {
    for (var row = 0; row < rows; row++) {
      gridColRows[col][row].neighborhood = getNeighborhood(col, row, gridColRows)
    }
  }
}

function setup() {
  canvasHeight = windowHeight - canvasFooter;
  canvasWidth = windowWidth;
  createCanvas(canvasWidth, canvasHeight + canvasFooter, document.getElementById('myCanvas'));
  frameRate(theFrameRate)

  secondarySetup()

  createConfigComponents();
}
  
function drawNNHistoryGraph(){
  let data = nnHistory
  let df = []
  for (var tick in data) {
    for (var nnid in data[tick]) {
      df.push({'tick':tick, 'neural_net_id':nnid, 'count':data[tick][nnid]})
    }
  }

  // We should have a DF that is an an array of objects with tick, neural_net_id, and count

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
      line: {width: 0.5},
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

  Plotly.newPlot('nnHistoryGraph', traces, layout)
}

let foodGrowthRateSlider;
let phageEatingRateSlider;
let phageSpreadThresholdSlider;
let phageChanceOfSpreadSlider;
let theFrameRateSlider;
let cellSizeSlider;
function createConfigComponents() {
  const offset = 17;

  let fakeUpdateDrawingTypeButton = createButton('Update Drawing Type')
  fakeUpdateDrawingTypeButton.position(150, canvasHeight)

  let offsetCount = 1;
  foodGrowthRateSlider = createSlider(0, 100, foodGrowthRate * 100, 1)
  foodGrowthRateSlider.position(5, canvasHeight + 3 + (offset * offsetCount))
  foodGrowthRateSlider.size(200)
  text('Food: Growth Rate', 210, canvasHeight + offset + (offset * offsetCount))

  offsetCount++;
  phageEatingRateSlider = createSlider(0, 100, phageEatingRate * 100, 1)
  phageEatingRateSlider.position(5, canvasHeight + 3 + (offset * offsetCount))
  phageEatingRateSlider.size(200)
  text('Phage: Voracity', 210, canvasHeight + offset + (offset * offsetCount))

  offsetCount++;
  phageSpreadThresholdSlider = createSlider(0, 100, phageSpreadThreshold * 100, 1)
  phageSpreadThresholdSlider.position(5, canvasHeight + 3 + (offset * offsetCount))
  phageSpreadThresholdSlider.size(200)
  text('Phage: Spread Threshold', 210, canvasHeight + offset + (offset * offsetCount))

  offsetCount++;
  phageChanceOfSpreadSlider = createSlider(0, 100, phageChanceOfSpread * 100, 1)
  phageChanceOfSpreadSlider.position(5, canvasHeight + 3 + (offset * offsetCount))
  phageChanceOfSpreadSlider.size(200)
  text('Phage: Chance of Spread', 210, canvasHeight + offset + (offset * offsetCount))

  offsetCount++;
  theFrameRateSlider = createSlider(1, 100, theFrameRate, 1)
  theFrameRateSlider.position(5, canvasHeight + 3 + (offset * offsetCount))
  theFrameRateSlider.size(200)
  text('Frame Rate', 210, canvasHeight + offset + (offset * offsetCount))

  // offsetCount++;
  // drawGridCheckbox = createCheckbox();
  // drawGridCheckbox.position(5, canvasHeight + 3 + (offset * offsetCount))
  // text('Show Grid', 25, canvasHeight + offset + (offset * offsetCount))

  offsetCount++;
  cellSizeSlider = createSlider(1, 100, cellSize, 1)
  cellSizeSlider.position(5, canvasHeight + 3 + (offset * offsetCount))
  cellSizeSlider.size(200)
  text('Cell Size (Resets)', 210, canvasHeight + offset + (offset * offsetCount))
}

function draw() {
  if (!mouseIsPressed) {
    iterateState();
  }

  const offset = 17;
  let highlightMutatedCells = false;

  foodGrowthRate = foodGrowthRateSlider.value() / 100.0;
  //   bacteriaEatingRate = bacteriaEatingRateSlider.value()/100.0;
  //   bacteriaCostOfReproduction = bacteriaCostOfReproductionSlider.value()/100.0;
  //   bacteriaChanceOfReproduction = bacteriaChanceOfReproductionSlider.value()/100.0;
  phageEatingRate = phageEatingRateSlider.value() / 100.0;
  phageSpreadThreshold = phageSpreadThresholdSlider.value() / 100.0;
  phageChanceOfSpread = phageChanceOfSpreadSlider.value() / 100.0;
  theNewFrameRate = theFrameRateSlider.value();

  if (theFrameRate != theNewFrameRate) {
    frameRate(theNewFrameRate);
    theFrameRate = theNewFrameRate;
  }

  if (cellSize != cellSizeSlider.value()) {
    cellSize = cellSizeSlider.value()
    secondarySetup()
  }

  // Summarize the count of the versions of NN
  nnCounts = {}
  for (var col = 0; col < gridColRows.length; col++) {
    for (var row = 0; row < gridColRows[col].length; row++) {
      cell = gridColRows[col][row];
      if (cell.bacterialnn) {
        nnId = cell.bacterialnn.nn.id
        if (nnCounts[nnId]) {
          nnCounts[nnId] += 1
        }
        else {
          nnCounts[nnId] = 1
        }
      }
    }
  }

  // See if the mouse is hovering over the text of a species in the footer
  let hoveredBacterialNeuralNetworkId = null;
  let hoveredBacterialNeuralNetworkLineage = null;
  hovered_cell = findCellFromXY(mouseX, mouseY, gridColRows);
  if (hovered_cell) {
    if (hovered_cell.bacterialnn) {
      //printBacterialNNScenarios(hovered_cell.bacterialnn)
      hoveredBacterialNeuralNetworkId = hovered_cell.bacterialnn.nn.id;
      hoveredBacterialNeuralNetworkLineage = hovered_cell.bacterialnn.nn.lineage;
    }
  }
  else {
    // See if we are mousing over one of the Bacteria Species descriptions as defined below
    let textSpacing = 14
    if(mouseX > 380 && mouseX < 580){
      if(mouseY > canvasHeight){
        let speciesIndex = int((mouseY - (canvasHeight + textSpacing)) / textSpacing) - 2
        let nnCountsKeys = Object.keys(nnCounts)
        if(speciesIndex >= 0 && speciesIndex < nnCountsKeys.length){
          hoveredBacterialNeuralNetworkId = nnCountsKeys[speciesIndex]
          hoveredBacterialNeuralNetworkLineage = []
        }
        else if(speciesIndex < 0){ // Means the mouse is hovering over the mutation count
          highlightMutatedCells = true;
        }
      }
    }
  }

  background(255);

  for (let col = 0; col < gridColRows.length; col++) {
    for (let row = 0; row < gridColRows[col].length; row++) {
      let adjust = 0
      fill(color(
        gridColRows[col][row].phage * 255,
        gridColRows[col][row].food * 255,
        gridColRows[col][row].bacteria * 255));
      //strokeWeight(drawGridCheckbox.checked() ? cellStroke : 0)
      strokeWeight(0)
      if(hoveredBacterialNeuralNetworkId && gridColRows[col][row].bacterialnn && gridColRows[col][row].bacterialnn.nn.id == hoveredBacterialNeuralNetworkId){
        if(compareArrays(hoveredBacterialNeuralNetworkLineage, gridColRows[col][row].bacterialnn.nn.lineage)){
          stroke('green')
        }
        else{
          stroke('red')
        }
        strokeWeight(2)
        adjust = 1
      }
      else if(highlightMutatedCells && gridColRows[col][row].bacterialnn && gridColRows[col][row].bacterialnn.nn.lineage.length > 0){
        stroke('yellow')
        strokeWeight(2)
        adjust = 1
      }
      square((col * cellSize) + adjust, (row * cellSize) + adjust, cellSize - (adjust * 2));
    }
  }

  noStroke()
  strokeWeight(cellStroke)
  fill('black')
  let percentThroughTheSeasons = (seasonalTicker%seasonalDuration)/seasonalDuration;
  let season = 'Spring';
  
  if(percentThroughTheSeasons<0.1){
    season = 'Spring';
  }
  else if(percentThroughTheSeasons<0.4){
    season = 'Summer';
  }
  else if(percentThroughTheSeasons<0.6){
    season = 'Fall';
  } else if(percentThroughTheSeasons<0.9){
    season = 'Winter';
  }
  
  text('Season: ' + season, 5, canvasHeight)
  text('Drawing Type: ' + inputTypes[inputType], 5, canvasHeight + 17)

  // print the counts in human readable form
  let species_text = 'Mutation Count: ' + nnMutationCount + '\nBacteria Species:'
  for (var key in nnCounts) {
    species_text += '\n- ID:' + key + ' - ' + nnCounts[key]
    if(key == hoveredBacterialNeuralNetworkId){
      species_text += ' (Selected)'
    }
  }

  text(species_text, 380, canvasHeight + 17)

  let offsetCount = 2;
  text('Food: Growth Rate', 210, canvasHeight + (offset * offsetCount))

  //   offsetCount++;
  //   text('Bacteria: Eating Rate', 210, canvasHeight + (offset*offsetCount))

  //   offsetCount++;
  //   text('Bacteria: Cost of Reproduction', 210, canvasHeight + (offset*offsetCount))

  //   offsetCount++;
  //   text('Bacteria: Chance of Reproduction', 210, canvasHeight + (offset*offsetCount))

  offsetCount++;
  text('Phage: Voracity', 210, canvasHeight + (offset * offsetCount))

  offsetCount++;
  text('Phage: Spread Threshold', 210, canvasHeight + (offset * offsetCount))

  offsetCount++;
  text('Phage: Chance of Spread', 210, canvasHeight + (offset * offsetCount))

  offsetCount++;
  text('Frame Rate', 210, canvasHeight + (offset * offsetCount))

  // offsetCount++;
  // text('Show Grid', 25, canvasHeight + (offset * offsetCount))

  offsetCount++;
  text('Cell Size (Resets)', 210, canvasHeight + (offset * offsetCount))

  if(hoveredBacterialNeuralNetworkId){
    // If there is a selected NN Id search for a matching NN in the grid
    let matchingNN = null
    for (let col = 0; col < gridColRows.length; col++) {
      for (let row = 0; row < gridColRows[col].length; row++) {
        if(gridColRows[col][row].bacterialnn && gridColRows[col][row].bacterialnn.nn.id == hoveredBacterialNeuralNetworkId){
          matchingNN = gridColRows[col][row].bacterialnn.nn
          if(compareArrays(hoveredBacterialNeuralNetworkLineage, gridColRows[col][row].bacterialnn.nn.lineage)){
            break;
          }
        }
      }
    }

    if(matchingNN){
      offsetCount++;
      printNN(matchingNN, 5, canvasHeight + (offset * offsetCount), neuralNetDisplayWidth, neuralNetDisplayHeight)
    }
  }
}

function printBacterialNNScenarios(bnn){
  print('Bacterial NN Scenarios')
  print('ID: ' + bnn.nn.id)
  print('Lineage: ' + bnn.nn.lineage)
  print('Mutation Rate: ' + bnn.nn.mutationRate)

  printBacterialNNScenario('The Starving Healthy Loner', bnn, 0.2, 0.4, 0, 0, 0)
  printBacterialNNScenario('The Starving Healthy Socialite', bnn, 0.2, 0.4, 0, 8, 0)
  printBacterialNNScenario('The Starving Healthy Infected Loner', bnn, 0.2, 0.4, 1, 0, 0)
  printBacterialNNScenario('The Starving Healthy Infected Socialite', bnn, 0.2, 0.4, 1, 8, 0)
  printBacterialNNScenario('The Starving Unhealthy Loner', bnn, 0.2, 0.1, 1, 0, 0)
  printBacterialNNScenario('The Starving Unhealthy Socialite', bnn, 0.2, 0.1, 1, 8, 0)
  printBacterialNNScenario('In a Time of Plenty, I was Sick and Alone', bnn, 0.8, 0.1, 1, 0, 0)
  printBacterialNNScenario('In a Time of Plenty, I was Sick and Social', bnn, 0.8, 0.1, 1, 8, 0)
  printBacterialNNScenario('In a Time of Plenty, I was Healthy and Alone', bnn, 0.8, 0.4, 0, 0, 0)
  printBacterialNNScenario('The Plague has a Plague, but at least I\'m well fed', bnn, 0.8, 0.4, 1, 7, 7)

}

function printBacterialNNScenario(scenarioName, bnn, food, health, isInfected, numNeighbors, numInfectedNeighbors){
  print('Bacterial NN Scenario - '+scenarioName+'\ninputs: food[' + food + '], health[' + health + '], isInfected[' + isInfected + '], numNeighbors[' + numNeighbors + '], numInfectedNeighbors[' + numInfectedNeighbors + ']')
  outputs = bnn.executeNN(food, health, isInfected, numNeighbors/9, numInfectedNeighbors/9)
  print('outputs: eatingRate[' + outputs[0] + '], costOfReproduction[' + outputs[1] + '], chanceOfReproduction[' + outputs[2] + '], shouldKillToReproduce[' + outputs[3] + ']')
}

function printNN(nn, x, y, width, height){
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

function compareArrays(array1, array2) {
  // null check, if either are null return false
  if (!array1 || !array2) {
    return false;
  }
  if (array1.length != array2.length) {
    return false;
  }
  for (var i = 0; i < array1.length; i++) {
    if (array1[i] != array2[i]) {
      return false;
    }
  }
  return true;
}