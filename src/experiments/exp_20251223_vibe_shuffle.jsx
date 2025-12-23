class MaxHeap {
    constructor() {
        this.heap = [];
    }

    push(val) {
        this.heap.push(val);
        this.bubbleUp();
    }

    pop() {
        if (this.size() === 0) return null;
        const max = this.heap[0];
        const last = this.heap.pop();
        if (this.size() > 0) {
            this.heap[0] = last;
            this.bubbleDown();
        }
        return max;
    }

    size() { return this.heap.length; }

    bubbleUp() {
        let index = this.heap.length - 1;
        while (index > 0) {
            let parentIndex = Math.floor((index - 1) / 2);
            if (this.heap[parentIndex].count >= this.heap[index].count) break;
            [this.heap[parentIndex], this.heap[index]] = [this.heap[index], this.heap[parentIndex]];
            index = parentIndex;
        }
    }

    bubbleDown() {
        let index = 0;
        while (true) {
            let left = 2 * index + 1;
            let right = 2 * index + 2;
            let swap = null;

            if (left < this.size() && this.heap[left].count > this.heap[index].count) swap = left;
            if (right < this.size()) {
                if ((swap === null && this.heap[right].count > this.heap[index].count) ||
                    (swap !== null && this.heap[right].count > this.heap[left].count)) swap = right;
            }

            if (swap === null) break;
            [this.heap[index], this.heap[swap]] = [this.heap[swap], this.heap[index]];
            index = swap;
        }
    }
}

/**
 * Shuffles items ensuring no two identical items are within distance k.
 * @param {Array} items - The list to shuffle
 * @param {number} k - Minimum distance between identical elements
 */
export function shuffleWithDistance(items, k) {
    const counts = {};
    for (const item of items) {
        counts[item] = (counts[item] || 0) + 1;
    }

    const maxHeap = new MaxHeap();
    for (const [val, count] of Object.entries(counts)) {
        maxHeap.push({ val, count });
    }

    const result = [];
    const waitlist = []; // Acting as a queue for the k-distance constraint

    while (result.length < items.length) {
        // If the heap is empty but we haven't finished, the constraint is impossible.
        if (maxHeap.size() === 0) {
            console.error("Impossible to satisfy distance constraint.");
            return null; 
        }

        // 1. Pick the most frequent available element
        let current = maxHeap.pop();
        result.push(current.val);
        current.count--;

        // 2. Add it to the waitlist (cool-down period)
        waitlist.push(current);

        // 3. Once the waitlist reaches size k, release the element back to heap if it still has count
        if (waitlist.length >= k) {
            let released = waitlist.shift();
            if (released.count > 0) {
                maxHeap.push(released);
            }
        }
    }

    return result;
}

// Example Usage:
const input = ['A', 'A', 'A', 'B', 'B', 'C'];
const k = 2;
console.log(shuffleWithDistance(input, k)); 
// Expected Output: ['A', 'B', 'A', 'B', 'C', 'A'] or similar
