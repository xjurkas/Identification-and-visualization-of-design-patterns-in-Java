CALL {

// 1. Strategy: lokálny interface alebo abstraktná trieda
MATCH (strategy)
WHERE (strategy:Interface OR (strategy:Class AND strategy.isAbstract = true))
  AND EXISTS { MATCH (strategy)-[:IN_FILE]->() }

// 2. ≥2 direct ConcreteStrategies
MATCH (strategyType:Type {fqn: strategy.fqn})
MATCH (cs)-[:IMPLEMENTS|EXTENDS]->(strategy)
WHERE cs:Class OR cs:Interface
WITH strategy, strategyType, count(DISTINCT cs) AS csCount
WHERE csCount >= 2

// 3. Context má field typu Strategy
MATCH (contextType:Type)-[:HAS_FIELD]->(field:Field)-[:FIELD_TYPE]->(strategyType)
WHERE contextType.fqn <> strategy.fqn

// 4. Context deleguje na Strategy (≥1 CALLS)
  AND EXISTS {
    MATCH (contextType)-[:DECLARES]->(ctxMethod:Method)-[:CALLS]->(stratMethod:Method)
    WHERE stratMethod.containerFqn = strategy.fqn
  }

WITH DISTINCT strategyType
SET strategyType:StrategyDP

RETURN DISTINCT strategyType
}

RETURN DISTINCT
  strategyType.fqn AS strategyFqn
ORDER BY strategyFqn;
