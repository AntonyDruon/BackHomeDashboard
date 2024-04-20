import mysql from "mysql";

const connection = mysql.createConnection({
  host: "localhost",
  user: "root", // ton nom d'utilisateur MySQL
  password: "", // ton mot de passe MySQL
  database: "homedashboard", // le nom de ta base de données MySQL
});

export default connection;
