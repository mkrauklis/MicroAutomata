# Micro Automata
## Description
This project aims to extend upon the ideas of [Conway's Game of Life](https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life) by creating a simulation much closer to true microbial life. The simulation allows for 4 cell types: food (green), bacteria (blue), and viral phages that attack the bacteria (red). I implemented a preliminary version of this concept in 2012 on Android; see: [MicroLife](https://github.com/mkrauklis/MicroLife). This implementation is a from-the-ground-up-port to JS as to make it available in the browser. It also incorporates several new concepts:
* Neural Networks - Bacteria operate on a neural net that takes inputs (avalable food, current health, if it's infected by a phage, how many neighboring bacteria there are, and how many of those neighbors are infected by phages) and generates behavioral outputs (eating rate, cost of reproduction and health of offspring {costlier reproduction produces healthier offspring}, and if the bacteria should kill neighbors to reproduce).
  * The neural nets are randomly structured with between 3 and 7 layers, each hidden layer having between 3 and 10 neurons.
  * All produced neural networks are fully connected (FCNN) and do not have any convolutions nor recurance.
  * The neural network was implemented using object oriented concepts (rather than a matrix approach) purposefully, trading performance for ease of understanding.
  * Mutation - The neural networks have some chance of mutation which will effect the weights, biases, and mutation chance for the individual cell. This changes the behavior of the bacterial cell in random ways: some positive, some detrimental.
  * Lineage Tracking - With each mutation a new bacterial lineage is created. This can be visualized by hovering over "Bacteria Species" which highlights all mutated cells with yellow, hovering over the ID of the bacteria which will color all original lineage with green and all mutations of that originating lineage in red, by mousing over the grid and inspecting the visualization of the neural net, or by inspecting the plotly-generated lineage chart. Examples are demonstrated below.
* Seasons - The rate at which the food grows varies "seasonally," peaking mid-summer and bottoming-out mid-winter.

# UI Features
## The Growing Field
The growing field defaults to a pure green, denoting abundant food. The colors of each cell in the field correspond to the levels of each corresponding state.
* Green - Food
* Blue - Bacteria
* Yellow - Phage
* Black - Wall

Walls cannot be traversed by bacteria nor phage, however a diagional gap can potentially leak if a bacteria or phage reproduces through the gap.

![Field Full of Food](README_MEDIA/field_food.png)
*Field Full of Food*

![Field With Bacteria](README_MEDIA/field_bacteria.png)
*Field With Bacteria*

![Field With Bacteria and Phage](README_MEDIA/field_phage.png)
*Field With Bacteria and Phage*

![Mature Field](README_MEDIA/field_complex.png)
*Mature Field*

![Field With Walls]()
*Field With Walls*

## Seasons


## Drawing Type
![alt text](README_MEDIA/drawing_type.png)

## Configuration Sliders
![alt text](README_MEDIA/configuration_sliders.png)

## Bacteria Info
![alt text](README_MEDIA/bacteria_metrics.png)

### Bacteria Neural Net Visualization
![alt text](README_MEDIA/neural_net.png)

## Bacterial Lineage Visualization
![alt text](README_MEDIA/lineage_visualization.png)

# Interesting Observations
## Evolutionary Pressure
### Seasons


### Phage Infection

# Future Enhancements
