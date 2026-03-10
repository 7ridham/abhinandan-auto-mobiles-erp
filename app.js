let customers = [
{name:"Mahesh Patel"},
{name:"Mahesh Kumar"},
{name:"Ramesh Shah"}
]

let searchInput = document.getElementById("customerSearch")

searchInput.addEventListener("keyup",function(){

let q = searchInput.value.toLowerCase()

let results = customers.filter(c =>
c.name.toLowerCase().includes(q)
)

let list = document.getElementById("customerList")
list.innerHTML=""

results.forEach(c=>{
let li=document.createElement("li")
li.innerText=c.name
list.appendChild(li)
})

})

function generateBill(){
alert("Bill generated successfully")
}
