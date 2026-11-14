import numpy as np
import pandas as pd

rng = np.random.default_rng(42)
n = 1000
df = pd.DataFrame({
    "id": range(1, n + 1),
    "age": rng.integers(20, 60, n),
    "salary": rng.normal(55000, 8000, n).round(0),
})

# inject 5 bad rows
df.loc[10, "age"] = 250
df.loc[20, "salary"] = 9999999
df.loc[30, "salary"] = -5000
df.loc[40, "age"] = 1
df.loc[50, ["age", "salary"]] = [22, 150000]

df.to_csv("big_sample.csv", index=False)
print("created big_sample.csv")