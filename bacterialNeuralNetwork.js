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

    generateRandomBacterialTopology() {
        // Always start with 5 and end with 4
        let topology = [5]

        let hiddenLayerCount = int(random(1, 5))
        for (var i = 0; i < hiddenLayerCount; i++) {
            topology.push(int(random(3, 10)))
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