---
id: dsa-striver-a2z
title: DSA — Striver A2Z Sheet
domain: dsa
description: Full Striver A2Z sheet paced for an experienced Java dev targeting Amazon SDE II. Known topics are blitzed; new algorithmic concepts get room to breathe.
labels: { chapter: phase, section: week, task: batch }
effort: { unit: problem, unitPlural: problems, minutesPerUnit: 25 }
tags: [interview, java, amazon, dsa]
---

# Phase 0 — Setup `#p0`
> weeks: 0 · pace: fast

One sitting. Get the tooling out of the way so it never becomes an excuse.

## Setup `#p0w0`
> week: 0

- [ ] Create LeetCode account; bookmark Striver's A2Z sheet `#t-p0-accounts` `@20m`
- [ ] Set up a Java repo for solutions, one file per problem `#t-p0-repo` `@30m`
- [ ] Confirm Big-O fluency + targeted math refresh (logs, modular, combinatorics, bits) `#t-p0-math` `@3h`
- [ ] Block a fixed daily study slot in the calendar `#t-p0-calendar` `@15m`

# Phase 1 — Blitz known territory (Weeks 1–3) `#p1`
> weeks: 1-3 · problems: 133 · pace: fast

You already own most of this. Speed-refresh: skim theory, re-solve only what feels rusty, pull work forward if a week is trivial.

## Week 1 — Foundations + Sorting `#p1w1`
> week: 1 · problems: 61

- [ ] Step 1 basics: Java essentials, logical thinking, all 22 patterns `#t-p1w1-basics` `@33`
- [ ] Basic Maths (7): digits, reverse, palindrome, GCD, Armstrong, divisors, prime `#t-p1w1-maths` `@7`
- [ ] Basic Recursion (9): print N times, factorial, reverse array, fibonacci `#t-p1w1-recursion` `@9`
- [ ] Basic Hashing (3) + Java Collections deep-dive (2) `#t-p1w1-hashing` `@5`
- [ ] Sorting I & II (7): selection, bubble, insertion, merge, quick `#t-p1w1-sorting` `@7`

## Week 2 — Arrays, entire step `#p1w2`
> week: 2 · problems: 40

- [ ] Easy (14): largest, dedupe, rotate, move zeros, union, missing number, longest subarray sum K `#t-p1w2-easy` `@14`
- [ ] Medium (14): Two Sum, sort 0s1s2s, majority, Kadane's, stock buy-sell, next permutation, spiral `#t-p1w2-medium` `@14`
- [ ] Hard (12): Pascal's, 3 Sum, 4 Sum, subarrays XOR K, merge intervals, count inversions, reverse pairs `#t-p1w2-hard` `@12`

## Week 3 — Binary Search, entire step `#p1w3`
> week: 3 · problems: 32

- [ ] BS on 1D (13): bounds, floor-ceil, occurrences, rotated I & II, peak element `#t-p1w3-1d` `@13`
- [ ] BS on answers (14): sqrt, Koko, bouquets, ship packages, aggressive cows, book allocation, median 2 sorted `#t-p1w3-answers` `@14`
- [ ] BS on 2D (5): row with max 1s, search 2D I & II, peak 2D, matrix median `#t-p1w3-2d` `@5`

# Phase 2 — Linear structures (Weeks 4–6) `#p2`
> weeks: 4-6 · problems: 131 · pace: fast

## Week 4 — Strings + Linked List `#p2w4`
> week: 4 · problems: 46

- [ ] Strings basic (7): remove outer parens, reverse words, LCP, isomorphic, anagram `#t-p2w4-str-basic` `@7`
- [ ] Strings medium (8): sort by freq, Roman→int, atoi, longest palindromic substring `#t-p2w4-str-medium` `@8`
- [ ] LL singly + doubly (9): intros, insert/delete head, length, search, DLL reverse `#t-p2w4-ll-basic` `@9`
- [ ] LL medium (15): middle, reverse, detect loop, palindrome, remove Nth, sort, intersection `#t-p2w4-ll-medium` `@15`
- [ ] DLL medium (3) + LL hard (4): reverse K-group, rotate, flatten, clone with random pointer `#t-p2w4-ll-hard` `@7`

## Week 5 — Recursion + Bit Manipulation `#p2w5`
> week: 5 · problems: 43

- [ ] Recursion strong hold (5): atoi, Pow(x,n), count good numbers, sort/reverse stack `#t-p2w5-rec-basic` `@5`
- [ ] Subsequences (12): generate parens, power set, combination sum I/II/III, subsets I/II `#t-p2w5-subseq` `@12`
- [ ] Combos/hard (8): palindrome partitioning, word search, N-Queen, rat in maze, Sudoku `#t-p2w5-backtrack` `@8`
- [ ] Bit manipulation (13): set bits, power of 2, single number I & III, XOR range `#t-p2w5-bits` `@13`
- [ ] Advanced maths (5): prime factors, divisors, count primes, sieve `#t-p2w5-advmath` `@5`

## Week 6 — Stack, Queue + Sliding Window `#p2w6`
> week: 6 · problems: 42

- [ ] Learning (8): stack/queue via arrays, via each other, via LL, balanced parens, min stack `#t-p2w6-learn` `@8`
- [ ] Conversions (6): infix/prefix/postfix all directions `#t-p2w6-convert` `@6`
- [ ] Monotonic stack (11): next greater I & II, trapping rain, subarray minimums, largest rectangle `#t-p2w6-monotonic` `@11`
- [ ] Implementation (5): sliding window max, stock span, celebrity, LRU, LFU `#t-p2w6-impl` `@5`
- [ ] Sliding window (12): longest substring no repeat, fruit baskets, min window substring `#t-p2w6-window` `@12`

# Phase 3 — Heaps & Greedy (Weeks 7–8) `#p3`
> weeks: 7-8 · problems: 32 · pace: moderate

New concepts — pace drops here. Understanding the heap invariant and greedy exchange arguments matters more than volume.

## Week 7 — Heaps `#p3w7`
> week: 7 · problems: 17

- [ ] Learning (4): theory, min-heap, check min-heap, min→max `#t-p3w7-learn` `@4`
- [ ] Medium (7): Kth largest/smallest, sort K-sorted, merge K lists, task scheduler `#t-p3w7-medium` `@7`
- [ ] Hard (6): Design Twitter, connect sticks, Kth largest stream, median from data stream `#t-p3w7-hard` `@6`

## Week 8 — Greedy `#p3w8`
> week: 8 · problems: 15

- [ ] Easy (4): assign cookies, fractional knapsack, lemonade, valid parens `#t-p3w8-easy` `@4`
- [ ] Medium/Hard (11): N meetings, jump game I & II, platforms, job sequencing, candy, intervals `#t-p3w8-hard` `@11`

# Phase 4 — Trees & BST (Weeks 9–11) `#p4`
> weeks: 9-11 · problems: 54 · pace: moderate

## Week 9 — Binary Trees: traversals + medium `#p4w9`
> week: 9 · problems: 24

- [ ] Traversals (12): pre/in/post recursive + iterative, level order, Morris prep `#t-p4w9-traversal` `@12`
- [ ] Medium (12): max depth, balanced, diameter, max path sum, zigzag, boundary, views `#t-p4w9-medium` `@12`

## Week 10 — Binary Trees: hard `#p4w10`
> week: 10 · problems: 14

- [ ] LCA, max width, nodes at distance K, burn tree, count complete nodes `#t-p4w10-a` `@7`
- [ ] Construct from pre+in & post+in, serialize-deserialize, Morris, flatten to LL `#t-p4w10-b` `@7`

## Week 11 — Binary Search Trees `#p4w11`
> week: 11 · problems: 16

- [ ] Concepts (3): intro, search, min/max `#t-p4w11-concepts` `@3`
- [ ] Practice (13): floor/ceil, insert, delete, validate, LCA, successor, merge, largest BST `#t-p4w11-practice` `@13`

# Phase 5 — Graphs (Weeks 12–14) `#p5`
> weeks: 12-14 · problems: 53 · pace: moderate

The heaviest conceptual step. One algorithm family per sitting — don't rush Dijkstra, Bellman-Ford, or MST.

## Week 12 — Learning + BFS/DFS `#p5w12`
> week: 12 · problems: 20

- [ ] Learning (6): intro, representation, connected components, traversal, DFS `#t-p5w12-learn` `@6`
- [ ] BFS/DFS (14): provinces, rotten oranges, flood fill, cycle detection, islands, bipartite `#t-p5w12-bfsdfs` `@14`

## Week 13 — Topo Sort + Shortest Path `#p5w13`
> week: 13 · problems: 20

- [ ] Topo (7): topo sort, Kahn's, course schedule I & II, safe states, alien dictionary `#t-p5w13-topo` `@7`
- [ ] Shortest path (13): Dijkstra, binary maze, min effort, cheapest flights, Bellman-Ford, Floyd-Warshall `#t-p5w13-shortest` `@13`

## Week 14 — MST, DSU + advanced `#p5w14`
> week: 14 · problems: 13

- [ ] MST/DSU (10): MST theory, Prim's, Disjoint Set, accounts merge, islands II, large island `#t-p5w14-mst` `@10`
- [ ] Other (3): bridges, articulation point, Kosaraju's `#t-p5w14-other` `@3`

# Phase 6 — Dynamic Programming (Weeks 15–18) `#p6`
> weeks: 15-18 · problems: 71 · pace: moderate

Highest-leverage, hardest step. Kept at ~15–18/week so you internalise the recurrences instead of pattern-matching them.

## Week 15 — Intro + 1D + grids `#p6w15`
> week: 15 · problems: 12

- [ ] Intro (1) + 1D (5): climbing stairs, frog jump (+K), non-adjacent sum, house robber `#t-p6w15-1d` `@6`
- [ ] 2D/Grids (6): ninja training, unique paths I & II, falling path, triangle, ninja friends `#t-p6w15-grid` `@6`

## Week 16 — DP on subsequences `#p6w16`
> week: 16 · problems: 11

- [ ] Subset sum, partition equal, min abs diff, count subsets K, count partitions diff `#t-p6w16-subset` `@5`
- [ ] Min coins, target sum, coin change 2, unbounded knapsack, rod cutting `#t-p6w16-knapsack` `@6`

## Week 17 — DP on strings + stocks `#p6w17`
> week: 17 · problems: 16

- [ ] Strings (10): LCS, longest common substring, palindromic subseq, edit distance, wildcard `#t-p6w17-strings` `@10`
- [ ] Stocks (6): buy/sell I–IV, with cooldown, with fee `#t-p6w17-stocks` `@6`

## Week 18 — LIS + MCM + squares `#p6w18`
> week: 18 · problems: 18

- [ ] LIS (7): LIS + print, largest divisible subset, string chain, bitonic, count LIS `#t-p6w18-lis` `@7`
- [ ] MCM (9): matrix chain, min cost cut stick, burst balloons, palindrome partition II `#t-p6w18-mcm` `@9`
- [ ] Squares (2): max rectangle of 1s, count square submatrices `#t-p6w18-squares` `@2`

# Phase 7 — Tries & advanced strings (Week 19) `#p7`
> weeks: 19 · problems: 16 · pace: moderate

## Week 19 — Tries + hard strings `#p7w19`
> week: 19 · problems: 16

- [ ] Tries (7): implementation, longest word all prefixes, distinct substrings, max XOR `#t-p7w19-tries` `@7`
- [ ] Strings hard (9): Rabin-Karp, Z-function, KMP/LPS, shortest palindrome, longest happy prefix `#t-p7w19-strings` `@9`

# Phase 8 — Revision & mocks (Week 20+) `#p8`
> weeks: 20 · pace: ongoing

## Ongoing `#p8w20`
> week: 20

- [ ] Re-solve every flagged problem from the weak-spots log `#t-p8-flagged` `@10h`
- [ ] Re-do Amazon-tagged LeetCode problems `#t-p8-amazon` `@10h`
- [ ] Timed mock interviews, 2–3 per week (Pramp / interviewing.io) `#t-p8-mocks` `@12h`
- [ ] Build a one-line-per-problem revision sheet `#t-p8-sheet` `@4h`
