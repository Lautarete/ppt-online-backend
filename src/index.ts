import express from "express";
import cors from "cors";
import { configDotenv } from "dotenv";

function runAPI() {
  configDotenv({
    path: "../.env",
  });
  const server = express();
  const PORT = process.env.PORT || 3001;
  server.use(express.json());
  server.use(cors());

  //   Aca falta toda la parte de la DB

  server.get("/", (request, response) => {
    response.send(
      `Hola, esta es la API y te estoy enviando data al puerto ${PORT}`,
    );
  });

  server.listen(PORT, () => {
    console.log(`Escuchando servidor en el puerto ${PORT}`);
  });
}

runAPI();
