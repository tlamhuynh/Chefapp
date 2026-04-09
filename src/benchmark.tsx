import React, { useState, useMemo } from 'react';
import { renderToString } from 'react-dom/server';

const numRecipes = 1000;
const rawRecipes = Array.from({ length: numRecipes }).map((_, i) => ({
  id: String(i),
  title: `Recipe ${i}`,
  theme: `Theme ${i % 10}`,
  ingredients: Array.from({ length: 15 }).map((_, j) => ({
    name: `Ingredient ${i}-${j}`,
    amount: j
  }))
}));

// Baseline: Re-computes inline on every render
function BaselineBenchmark() {
  let totalTime = 0;

  // Simulate 100 re-renders
  for (let i = 0; i < 100; i++) {
    const start = performance.now();
    const searchFilter = `Ingredient ${i}`; // simulates typing

    const filteredRecipes = rawRecipes.filter(r => {
      const searchLower = searchFilter.toLowerCase();
      const titleMatch = r.title.toLowerCase().includes(searchLower);
      const themeMatch = r.theme?.toLowerCase().includes(searchLower);
      const ingredientMatch = r.ingredients?.some((ing: any) =>
        ing.name.toLowerCase().includes(searchLower)
      );
      return titleMatch || themeMatch || ingredientMatch;
    });

    const jsx = (
      <div>
        {filteredRecipes.map((recipe) => (
          <div key={recipe.id}>
            <p>{recipe.ingredients?.map((i: any) => i.name).join(', ')}</p>
          </div>
        ))}
      </div>
    );
    renderToString(jsx);
    totalTime += performance.now() - start;
  }
  return totalTime;
}

// Optimized: Pre-computes at data-fetch time (or memoized equivalent)
function OptimizedBenchmark() {
  let totalTime = 0;

  // Simulate data fetching logic once
  const recipes = rawRecipes.map(r => ({
    ...r,
    ingredientsStr: r.ingredients?.map((i: any) => i.name).join(', ')
  }));

  // Simulate 100 re-renders
  for (let i = 0; i < 100; i++) {
    const start = performance.now();
    const searchFilter = `Ingredient ${i}`; // simulates typing

    const filteredRecipes = recipes.filter(r => {
      const searchLower = searchFilter.toLowerCase();
      const titleMatch = r.title.toLowerCase().includes(searchLower);
      const themeMatch = r.theme?.toLowerCase().includes(searchLower);
      // We can also optimize the search to use the pre-computed string!
      const ingredientMatch = r.ingredientsStr?.toLowerCase().includes(searchLower);
      return titleMatch || themeMatch || ingredientMatch;
    });

    const jsx = (
      <div>
        {filteredRecipes.map((recipe) => (
          <div key={recipe.id}>
            <p>{recipe.ingredientsStr}</p>
          </div>
        ))}
      </div>
    );
    renderToString(jsx);
    totalTime += performance.now() - start;
  }
  return totalTime;
}

console.log("Measuring Baseline...");
const baselineTime = BaselineBenchmark();
console.log(`Baseline total time for 100 renders: ${baselineTime.toFixed(2)} ms`);

console.log("Measuring Optimized...");
const optimizedTime = OptimizedBenchmark();
console.log(`Optimized total time for 100 renders: ${optimizedTime.toFixed(2)} ms`);
const improvement = ((baselineTime - optimizedTime) / baselineTime) * 100;
console.log(`Improvement: ${improvement.toFixed(2)}%`);
