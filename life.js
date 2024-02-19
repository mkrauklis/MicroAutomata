var canvasHeight = 600;
var canvasFooter = 20;
var canvasWidth = 600;
var cellSize = 20;
var theFrameRate = 5;
var cellStroke = 0.25;

// Game parameters
var foodGrowthRate = 0.1
var bacteriaEatingRate = 0.15
var bacteriaCostOfReproduction = 0.4
var bacteriaChanceOfReproduction = 0.5
var phageEatingRate = 0.05;
var phageDurabilityRate = 0.05;

// gridColRows[COLS][ROWS]
var gridColRows = null;
var gridColRowsTomorrow = null;

var inputTypes=['Food','Bacteria','Phage','Wall'];
var inputType=1; // Default to Bacteria

var reproductionDirections=['UpLeft','Up','UpRight','Left','Right','DownLeft','Down','DownRight']

class State{
  update(food, bacteria, phage, wall){
    this.food = food
    this.bacteria = bacteria
    this.phage = phage
    this.wall = wall
  }
  
  constructor(col, row){
    this.col = col
    this.row = row
    
    // Initialize to food
    this.food = 1.0
    this.bacteria = 0.0
    this.phage = 0.0
    this.wall = 0.0
  }
}

function setup() {
  createCanvas(canvasWidth, canvasHeight + canvasFooter);
  frameRate(theFrameRate)
  cols = canvasWidth / cellSize;
  rows = canvasHeight / cellSize;
  gridColRows = new Array(cols)
  gridColRowsTomorrow = new Array(cols)
  for(var col=0;col<cols;col++){
    gridColRows[col]=new Array(rows);
    gridColRowsTomorrow[col]=new Array(rows);
    for(var row=0;row<rows;row++){
      gridColRows[col][row]=new State(col, row);
      gridColRowsTomorrow[col][row]=new State(col, row);
    }
  }
}

function iterateState(){
  for(var col=0;col<gridColRows.length;col++){
    for(var row=0;row<gridColRows[col].length;row++){
      cellToday = gridColRows[col][row];
      cellTomorrow = gridColRowsTomorrow[col][row];
      // TODO: Calculate neighborhoods at initialization
      neighborhood = getNeighborhood(col, row, gridColRows);
      neighborhoodTomorrow = getNeighborhood(col, row, gridColRowsTomorrow)
      
      iterateStateCellsNeighborhood(cellToday, cellTomorrow, neighborhood, neighborhoodTomorrow);
    }
  }
  
  // Swap gridColRowss
  gridColRowsLocal=gridColRowsTomorrow;
  gridColRowsTomorrow=gridColRows;
  gridColRows=gridColRowsLocal;
}

function getNeighborhood(col, row, gridColRows){
  //print('getting neighborhood for '+col+','+row)
  col--;
  row--;
  if(col<0){
    col+=gridColRows.length;
  }
  if(row<0){
    row+=gridColRows[col].length;
  }
  
  neighborhood = new Array(3);
  
  // we now have the top left of the neighborhood
  // we do this so we can use simple modulo from left to right to get the wrapped cells
  // we want to create a 3x3 array of nodes representing the neighborhood
  for(var colOffset=0;colOffset<3;colOffset++){
    neighborhood[colOffset] = new Array(3)
    for(var rowOffset=0;rowOffset<3;rowOffset++){
      colPlusOffset = (col+colOffset)%gridColRows.length
      rowPlusOffset = (row+rowOffset)%gridColRows[col].length
      neighborhood[colOffset][rowOffset]=gridColRows[colPlusOffset][rowPlusOffset]
      //print('['+colPlusOffset+']['+rowPlusOffset+']')
    }
  }
  
  return neighborhood;
}

// foodGrowthRate
// bacteriaEatingRate
// bacteriaCostOfReproduction
// phageEatingRate
// phageDurabilityRate
function iterateStateCellsNeighborhood(cell, cellTomorrow, neighborhood, neighborhoodTomorrow){
  //printCell(cell)
  
  //print('today: '+cell.bacteria)
  //print('tomorrow: '+cellTomorrow.bacteria)
  
  //// Handle Food
  // If there is no wall, increase food
  if(cell.food == 0.0 && cell.bacteria > 0.0){
    // do nothing, the bacteria gobbled up all the food and we can't do anything until it dies
    cellTomorrow.food = cell.food
  }
  else if(cell.wall == 0.0){
    cellTomorrow.food = Math.min(1.0, cell.food + foodGrowthRate);
  }
  else{
    cellTomorrow.food = 0.0;
  }
  
  //// Handle Bacteria
  if(cell.bacteria > 0.0){
  // Eat
    if(cellTomorrow.food > 0.0){
      cellTomorrow.bacteria = Math.min(1.0, cell.bacteria + Math.min(cellTomorrow.food, bacteriaEatingRate));
      cellTomorrow.food = Math.max(0.0, cellTomorrow.food - bacteriaEatingRate);
    }
    else{
      cellTomorrow.bacteria = Math.max(0.0, cell.bacteria - bacteriaEatingRate);
    }
    
    // Reproduce... if you can afford it and you didn't just get reproduced
    if((cellTomorrow.bacteria > (2*bacteriaCostOfReproduction)) & (random() < bacteriaChanceOfReproduction)){
      // Attempt to reproduce in a random direction
      // reproductionDirections=['UpLeft','Up','UpRight','Left','Right','DownLeft','Down','DownRight']
      
      targetReproductionCell = null;
      targetReproductionCellTomorrow = null;
      
      switch(random(reproductionDirections)){
        case 'UpLeft':
          targetReproductionCell = neighborhood[0][0];
          targetReproductionCellTomorrow = neighborhoodTomorrow[0][0];
          break;
        case 'Up':
          targetReproductionCell = neighborhood[1][0];
          targetReproductionCellTomorrow = neighborhoodTomorrow[1][0];
          break;
        case 'UpRight':
          targetReproductionCell = neighborhood[2][0];
          targetReproductionCellTomorrow = neighborhoodTomorrow[2][0];
          break;
        case 'Left':
          targetReproductionCell = neighborhood[0][1];
          targetReproductionCellTomorrow = neighborhoodTomorrow[0][1];
          break;
        case 'Right':
          targetReproductionCell = neighborhood[2][1];
          targetReproductionCellTomorrow = neighborhoodTomorrow[2][1];
          break;
        case 'DownLeft':
          targetReproductionCell = neighborhood[0][2];
          targetReproductionCellTomorrow = neighborhoodTomorrow[0][2];
          break;
        case 'Down':
          targetReproductionCell = neighborhood[1][2];
          targetReproductionCellTomorrow = neighborhoodTomorrow[1][2];
          break;
        case 'DownRight':
          targetReproductionCell = neighborhood[2][2];
          targetReproductionCellTomorrow = neighborhoodTomorrow[2][2];
          break;
        default:
          alert('This should never happen!!')
      }
      
      //print('target:col/row:'+targetReproductionCell.col+'/'+targetReproductionCell.row)
      //print('targettmrw:col/row:'+targetReproductionCellTomorrow.col+'/'+targetReproductionCellTomorrow.row)
      
      cellTomorrow.bacteria = Math.max(0.0, cell.bacteria - bacteriaCostOfReproduction)
      if(targetReproductionCell.wall == 0.0 && targetReproductionCell.bacteria == 0.0){
        // just setting both for simplicity
        targetReproductionCell.bacteria = bacteriaCostOfReproduction
        targetReproductionCellTomorrow.bacteria = bacteriaCostOfReproduction
        gridColRows[targetReproductionCell.col][targetReproductionCell.row].bacteria = bacteriaCostOfReproduction; // have to set this for cells that haven't been processed yet (right and down)
        gridColRowsTomorrow[targetReproductionCell.col][targetReproductionCell.row].bacteria = bacteriaCostOfReproduction; // have to set this for cells that have been processed already (left and up)
      }
    }
  }
  else{
    cellTomorrow.bacteria = cell.bacteria;
  }
  
  //// Handle Phage
  
  //print('out.today: '+cell.bacteria)
  //print('out.tomorrow: '+cellTomorrow.bacteria)
}

function mouseDragged() {
  updateCellForInput(findCellFromXY(mouseX, mouseY));
}

function mouseClicked(){
  printCell(findCellFromXY(mouseX, mouseY))
  updateCellForInput(findCellFromXY(mouseX, mouseY));
}

function printCell(cell){
  print('cell(col:'+cell.col+', row:'+cell.row+', '+cell.food+','+cell.bacteria+','+cell.phage+','+cell.wall+')')
}

function updateCellForInput(cell){
  if(cell){
    // 'Food','Bacteria','Phage','Wall'
    if(inputType == 0){
      cell.update(1.0,0.0,0.0,0.0)
    } else if(inputType == 1){
      cell.update(cell.food,1.0,0.0,0.0)
    } else if(inputType == 2){
      cell.update(cell.food,cell.bacteria,1.0,0.0)
    } else if(inputType == 3){
      cell.update(0.0,0.0,0.0,1.0)
    }
  }
}

function mouseWheel(event){
  if(event.delta > 0){
    inputType=(inputType+1)%4
  }
  else{
    inputType=(inputType+3)%4
  }
}

function findCellFromXY(x, y){
  if(x>=0&&y>=0){
    if(x<canvasWidth && y<canvasHeight){
      return gridColRows[int(x/cellSize)][int(y/cellSize)];
    }
  }
  return null;
}

function draw() {
  if(!mouseIsPressed){
    iterateState();
  }
  
  background(255);
  
  for(let col=0;col<gridColRows.length;col++){
    for(let row=0;row<gridColRows[col].length;row++){
      fill(color(
        gridColRows[col][row].phage*255,
        gridColRows[col][row].food*255,
        gridColRows[col][row].bacteria*255));
      strokeWeight(cellStroke)
      square(col*cellSize, row*cellSize, cellSize);
    }
  }
  
  fill('black')
  text('Drawing Type: '+inputTypes[inputType], 5, canvasHeight + canvasFooter - 3)
}
