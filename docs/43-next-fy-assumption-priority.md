# Next FY Assumption Priority

Lower numeric `priority` wins first. When priorities are equal, specificity wins:

1. Manual line override
2. Coding + Location
3. Category + Location
4. Coding
5. Location
6. Owner
7. Category
8. Global growth
9. Default zero growth

The engine does not silently combine multiple growth percentages. Equally specific conflicting rules are rejected with `NEXT_FY_AMBIGUOUS_ASSUMPTION_RULE`.

Fixed amount adjustments are applied only from the selected winning rule in this phase.
