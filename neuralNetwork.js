

var nnMutationCount = 0;
var nnNeuralNetCounter = 1;
var nnBaselineMutationRate = 0.00001

// Random number between -1 and 1
function nnGenerateRandomSeed() {
    return (random() - 0.5) * 2
}

// NNInput represents a neuron in the first layer of the neural network.
// It has no input edges, and only an output value.
class NNInput {
    constructor() {
        this.output = 0.0
    }
}

// NNNeuron represents a neuron in the hidden layers of the neural network.
class NNNeuron {
    constructor(inputs, copyFrom) {
        this.inputs = inputs
        this.output = 0.0
        this.weights = []
        this.bias = 0.0 // Note, bias is specific to each neuron which is not typical in a feed forward network

        if (!this.inputs || this.inputs.length == 0) {
            print('Error: No inputs for neuron')
        }

        if (copyFrom) {
            this.weights = copyFrom.weights.slice()
            this.bias = copyFrom.bias
        }
        else {
            for (var i = 0; i < inputs.length; i++) {
                this.weights.push(nnGenerateRandomSeed())
            }
            this.bias = nnGenerateRandomSeed()
        }
    }

    activate() {
        var sum = 0.0

        for (var i = 0; i < this.inputs.length; i++) {
            sum += this.inputs[i].output * this.weights[i]
        }
        sum += this.bias

        // Use a linear projection of the possible range to -1 to 1
        // Possible range is the size of the inputs + 1 both positive and negative
        let rangeMax = this.inputs.length + 1

        this.output = sum / rangeMax
    }

    outputToZeroOneRange() {
        let value = this.output * 5 + 0.5
        value = Math.max(0, value)
        value = Math.min(1, value)
        return value
    }
}

// NNInputLayer represents the first layer of the neural network.
class NNInputLayer {
    constructor(numberOfInputs) {
        this.neurons = []
        for (var i = 0; i < numberOfInputs; i++) {
            this.neurons.push(new NNInput())
        }
    }
}

// NNLayer represents a hidden or output layer in the neural network.
class NNLayer {
    constructor(inputs, numberOfNeurons, copyFrom) {
        this.neurons = []
        for (var i = 0; i < numberOfNeurons; i++) {
            this.neurons.push(new NNNeuron(inputs, copyFrom ? copyFrom.neurons[i] : null))
        }
    }

    activate() {
        for (var i = 0; i < this.neurons.length; i++) {
            this.neurons[i].activate()
        }
    }
}

// NNetwork represents a neural network with a given topology.
class NNetwork {
    // topology is an array of integers representing the number of neurons in each layer
    constructor(topology, copyFrom, isReproduction = false) {
        this.id = copyFrom ? copyFrom.id : nnNeuralNetCounter++
        this.lineage = copyFrom ? copyFrom.lineage.slice() : []
        this.mutationRate = copyFrom ? copyFrom.mutationRate : (nnBaselineMutationRate * random())
        this.layers = []
        this.layers.push(new NNInputLayer(topology[0]))

        for (var i = 1; i < topology.length; i++) {
            this.layers.push(new NNLayer(this.layers[i - 1].neurons, topology[i], copyFrom ? copyFrom.layers[i] : null))
        }

        if (isReproduction) {
            let mutated = this.mutate()

            if (mutated) {
                this.lineage.push(nnNeuralNetCounter++)
            }
        }
    }

    mutate() {
        var mutated = false
        for (var i = 1; i < this.layers.length; i++) {
            for (var j = 0; j < this.layers[i].neurons.length; j++) {
                for (var k = 0; k < this.layers[i].neurons[j].weights.length; k++) {
                    if (random() < this.mutationRate) {
                        this.layers[i].neurons[j].weights[k] = nnGenerateRandomSeed()
                        mutated = true
                    }
                }
                if (random() < this.mutationRate) {
                    this.layers[i].neurons[j].bias = nnGenerateRandomSeed()
                    mutated = true
                }
            }
        }
        if (random() < this.mutationRate) {
            this.mutationRate = nnBaselineMutationRate * random()
            mutated = true
        }

        if (mutated) {
            nnMutationCount++
        }

        return mutated
    }
}