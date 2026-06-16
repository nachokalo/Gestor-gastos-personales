let CATEGORIAS = {};
let chartInstance = null;

function cargarMovimientos() {
    return JSON.parse(localStorage.getItem("finanzas_mov")) || [];
}

function guardarMovimientos(movimientos) {
    localStorage.setItem("finanzas_mov", JSON.stringify(movimientos));
}

function cargarPresupuestos() {
    return JSON.parse(localStorage.getItem("finanzas_pres")) || [];
}

function guardarPresupuestos(presupuestos) {
    localStorage.setItem("finanzas_pres", JSON.stringify(presupuestos));
}

function formatMonto(n) {
    return "$" + Number(n).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function getMesActual() {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
}

function formatFecha(fechaStr) {
    const [y, m, d] = fechaStr.split("-");
    const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    return `${d} ${meses[parseInt(m) - 1]}`;
}

function getCatInfo(nombre, tipo) {
    const lista = CATEGORIAS[tipo] || CATEGORIAS.gasto || [];
    return lista.find(c => c.nombre === nombre) || { nombre, icon: "📦", color: "#6b7280" };
}

function generarId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function showToast(msg, tipo = "success") {
    const toast = document.getElementById("toast");
    toast.textContent = (tipo === "success" ? "✓ " : "✗ ") + msg;
    toast.className = `toast ${tipo} show`;
    setTimeout(() => { toast.className = "toast"; }, 2800);
}

function calcularResumen(movimientos, mes = null) {
    const filtrados = mes ? movimientos.filter(m => m.fecha.startsWith(mes)) : movimientos;
    const ingresos = filtrados.filter(m => m.tipo === "ingreso").reduce((acc, m) => acc + Number(m.monto), 0);
    const gastos = filtrados.filter(m => m.tipo === "gasto").reduce((acc, m) => acc + Number(m.monto), 0);
    return { ingresos, gastos, ahorro: ingresos - gastos };
}

function calcularSaldoTotal(movimientos) {
    return movimientos.reduce((acc, m) => m.tipo === "ingreso" ? acc + Number(m.monto) : acc - Number(m.monto), 0);
}

function gastosPorCategoria(movimientos, mes = null) {
    const filtrados = (mes ? movimientos.filter(m => m.fecha.startsWith(mes)) : movimientos).filter(m => m.tipo === "gasto");
    const mapa = filtrados.reduce((acc, m) => {
        acc[m.categoria] = (acc[m.categoria] || 0) + Number(m.monto);
        return acc;
    }, {});
    return Object.entries(mapa).map(([nombre, total]) => ({ nombre, total })).sort((a, b) => b.total - a.total);
}

function gastosPorMes(movimientos) {
    const mapa = movimientos.filter(m => m.tipo === "gasto").reduce((acc, m) => {
        const mes = m.fecha.slice(0, 7);
        acc[mes] = (acc[mes] || 0) + Number(m.monto);
        return acc;
    }, {});
    return Object.entries(mapa).sort(([a], [b]) => a.localeCompare(b)).slice(-6);
}

function crearTxItem(movimiento, conDelete = true) {
    const cat = getCatInfo(movimiento.categoria, movimiento.tipo);
    const esIngreso = movimiento.tipo === "ingreso";

    const item = document.createElement("div");
    item.className = "tx-item";

    const icon = document.createElement("div");
    icon.className = "tx-icon";
    icon.style.background = cat.color + "22";
    icon.textContent = cat.icon;

    const info = document.createElement("div");
    info.className = "tx-info";

    const name = document.createElement("div");
    name.className = "tx-name";
    name.textContent = movimiento.descripcion || movimiento.categoria;

    const catLabel = document.createElement("div");
    catLabel.className = "tx-cat";
    catLabel.textContent = `${movimiento.categoria} · ${movimiento.metodo}`;

    info.appendChild(name);
    info.appendChild(catLabel);

    const right = document.createElement("div");
    right.className = "tx-right";

    const amount = document.createElement("div");
    amount.className = `tx-amount ${esIngreso ? "pos" : "neg"}`;
    amount.textContent = `${esIngreso ? "+" : "-"}${formatMonto(movimiento.monto)}`;

    const fecha = document.createElement("div");
    fecha.className = "tx-date";
    fecha.textContent = formatFecha(movimiento.fecha);

    right.appendChild(amount);
    right.appendChild(fecha);

    item.appendChild(icon);
    item.appendChild(info);
    item.appendChild(right);

    if (conDelete) {
        const del = document.createElement("button");
        del.className = "tx-delete";
        del.textContent = "✕";
        del.title = "Eliminar";
        del.addEventListener("click", (e) => {
            e.stopPropagation();
            eliminarMovimiento(movimiento.id);
        });
        item.appendChild(del);
    }

    return item;
}

function renderDashboard() {
    const movimientos = cargarMovimientos();
    const mes = getMesActual();
    const { ingresos, gastos, ahorro } = calcularResumen(movimientos, mes);
    const saldo = calcularSaldoTotal(movimientos);

    const hora = new Date().getHours();
    const saludo = hora < 12 ? "Buenos días" : hora < 18 ? "Buenas tardes" : "Buenas noches";
    document.getElementById("dash-title").textContent = `${saludo} 👋`;

    document.getElementById("saldo-total").textContent = formatMonto(saldo);
    document.getElementById("ingresos-mes").textContent = formatMonto(ingresos);
    document.getElementById("gastos-mes").textContent = formatMonto(gastos);

    const ahorroEl = document.getElementById("ahorro-mes");
    ahorroEl.textContent = formatMonto(ahorro);
    ahorroEl.className = `card-value ${ahorro >= 0 ? "green" : "red"}`;
    document.getElementById("ahorro-sub").textContent = ahorro >= 0 ? "¡Vas bien este mes! 🎉" : "Estás gastando más de lo que ingresa";

    const contenedor = document.getElementById("lista-reciente");
    contenedor.innerHTML = "";
    const ultimos = [...movimientos].reverse().slice(0, 5);

    if (ultimos.length === 0) {
        contenedor.innerHTML = `<div class="empty-state"><div class="empty-icon">📂</div>Sin movimientos aún.<br>¡Agregá tu primer registro!</div>`;
    } else {
        ultimos.forEach(m => contenedor.appendChild(crearTxItem(m, false)));
    }

    const cats = gastosPorCategoria(movimientos, mes).slice(0, 6);
    const catContenedor = document.getElementById("lista-categorias");
    catContenedor.innerHTML = "";

    if (cats.length === 0) {
        catContenedor.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div>Sin gastos este mes</div>`;
    } else {
        const maxTotal = cats[0].total;
        cats.forEach(({ nombre, total }) => {
            const cat = getCatInfo(nombre, "gasto");
            const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
            const item = document.createElement("div");
            item.className = "cat-item";
            item.innerHTML = `
                <span style="font-size:16px">${cat.icon}</span>
                <div class="cat-dot" style="background:${cat.color}"></div>
                <span class="cat-name">${nombre}</span>
                <div class="cat-bar-wrap">
                    <div class="cat-bar-fill" style="width:${pct}%;background:${cat.color}"></div>
                </div>
                <span class="cat-amount" style="color:${cat.color}">${formatMonto(total)}</span>
            `;
            catContenedor.appendChild(item);
        });
    }
}

function renderMovimientos() {
    const movimientos = cargarMovimientos();
    const busqueda   = document.getElementById("search-input").value.toLowerCase();
    const tipoFiltro = document.getElementById("filter-type").value;
    const mesFiltro  = document.getElementById("filter-mes").value;
    const catFiltro  = document.getElementById("filter-cat").value;

    let filtrados = [...movimientos].reverse();
    if (tipoFiltro !== "todos") filtrados = filtrados.filter(m => m.tipo === tipoFiltro);
    if (mesFiltro  !== "todos") filtrados = filtrados.filter(m => m.fecha.startsWith(mesFiltro));
    if (catFiltro  !== "todos") filtrados = filtrados.filter(m => m.categoria === catFiltro);
    if (busqueda) {
        filtrados = filtrados.filter(m =>
            (m.descripcion || "").toLowerCase().includes(busqueda) ||
            m.categoria.toLowerCase().includes(busqueda)
        );
    }

    const contenedor = document.getElementById("lista-movimientos");
    contenedor.innerHTML = "";

    if (filtrados.length === 0) {
        contenedor.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div>No se encontraron movimientos</div>`;
        return;
    }

    filtrados.forEach(m => contenedor.appendChild(crearTxItem(m)));
}

function poblarFiltros() {
    const movimientos = cargarMovimientos();
    const meses = [...new Set(movimientos.map(m => m.fecha.slice(0, 7)))].sort().reverse();
    const selectMes = document.getElementById("filter-mes");
    selectMes.innerHTML = `<option value="todos">Todos los meses</option>`;
    const nombresMes = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    meses.forEach(mes => {
        const [y, m] = mes.split("-");
        const opt = document.createElement("option");
        opt.value = mes;
        opt.textContent = `${nombresMes[parseInt(m)-1]} ${y}`;
        selectMes.appendChild(opt);
    });

    const cats = [...new Set(movimientos.map(m => m.categoria))].sort();
    const selectCat = document.getElementById("filter-cat");
    selectCat.innerHTML = `<option value="todos">Todas las categorías</option>`;
    cats.forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.textContent = cat;
        selectCat.appendChild(opt);
    });
}

function renderEstadisticas() {
    const movimientos = cargarMovimientos();
    const mes = getMesActual();
    const porMes = gastosPorMes(movimientos);
    const nombresMes = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

    const labels = porMes.map(([mesKey]) => {
        const [, m] = mesKey.split("-");
        return nombresMes[parseInt(m)-1];
    });
    const valores = porMes.map(([, total]) => total);
    const colores = porMes.map(([mesKey]) => mesKey === mes ? "#6366f1" : "#3f3f5a");

    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }

    if (typeof Chart !== "undefined") {
        const ctx = document.getElementById("chart-gastos").getContext("2d");
        chartInstance = new Chart(ctx, {
            type: "bar",
            data: {
                labels,
                datasets: [{
                    label: "Gastos ($)",
                    data: valores,
                    backgroundColor: colores,
                    borderRadius: 6,
                    borderSkipped: false,
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => " " + formatMonto(ctx.parsed.y)
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: "#ffffff08" },
                        ticks: { color: "#6b6b7e" }
                    },
                    y: {
                        grid: { color: "#ffffff08" },
                        ticks: {
                            color: "#6b6b7e",
                            callback: (val) => formatMonto(val)
                        }
                    }
                }
            }
        });
    }

    const cats = gastosPorCategoria(movimientos, mes);
    const totalGastos = cats.reduce((acc, c) => acc + c.total, 0);
    const contenedor = document.getElementById("stats-categorias");
    contenedor.innerHTML = "";

    if (cats.length === 0) {
        contenedor.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div>Sin gastos este mes</div>`;
    } else {
        cats.forEach(({ nombre, total }) => {
            const cat = getCatInfo(nombre, "gasto");
            const pct = totalGastos > 0 ? ((total / totalGastos) * 100).toFixed(1) : 0;
            const item = document.createElement("div");
            item.className = "cat-item";
            item.style.padding = "14px 22px";
            item.innerHTML = `
                <span style="font-size:18px">${cat.icon}</span>
                <div class="cat-dot" style="background:${cat.color};width:10px;height:10px;"></div>
                <span class="cat-name">${nombre}</span>
                <div class="cat-bar-wrap" style="width:160px;">
                    <div class="cat-bar-fill" style="width:${pct}%;background:${cat.color}"></div>
                </div>
                <span style="font-size:12px;color:var(--muted);min-width:40px;">${pct}%</span>
                <span class="cat-amount" style="color:${cat.color}">${formatMonto(total)}</span>
            `;
            contenedor.appendChild(item);
        });
    }

    const { ingresos, gastos, ahorro } = calcularResumen(movimientos, mes);
    const insightsEl = document.getElementById("insights");
    insightsEl.innerHTML = "";
    const txMes = movimientos.filter(m => m.fecha.startsWith(mes)).length;
    const lista = [];

    if (ingresos > 0) {
        const pct = ((ahorro / ingresos) * 100).toFixed(0);
        lista.push(ahorro >= 0
            ? `🎯 Estás ahorrando el <strong>${pct}%</strong> de tus ingresos este mes.`
            : `⚠️ Gastás más de lo que ingresa. Diferencia: <strong>${formatMonto(Math.abs(ahorro))}</strong>.`
        );
    }
    if (cats.length > 0) {
        lista.push(`📊 Tu mayor gasto es en <strong>${cats[0].nombre}</strong>: <strong>${formatMonto(cats[0].total)}</strong>.`);
    }
    lista.push(`📝 Registraste <strong>${txMes}</strong> movimiento${txMes !== 1 ? "s" : ""} este mes.`);

    lista.forEach(txt => {
        const p = document.createElement("p");
        p.innerHTML = txt;
        p.style.cssText = "font-size:13px;color:var(--muted2);margin-bottom:14px;line-height:1.7;";
        insightsEl.appendChild(p);
    });
}

function renderPresupuestos() {
    const movimientos  = cargarMovimientos();
    const presupuestos = cargarPresupuestos();
    const mes  = getMesActual();
    const cats = gastosPorCategoria(movimientos, mes);
    const contenedor = document.getElementById("lista-presupuestos");
    contenedor.innerHTML = "";

    if (presupuestos.length === 0) {
        contenedor.innerHTML = `<div class="empty-state"><div class="empty-icon">◷</div>Sin presupuestos aún.<br>Creá uno a la derecha.</div>`;
        return;
    }

    presupuestos.forEach(p => {
        const catGasto = cats.find(c => c.nombre === p.categoria);
        const gastado = catGasto ? catGasto.total : 0;
        const pct = p.limite > 0 ? Math.min((gastado / p.limite) * 100, 100).toFixed(1) : 0;
        const color = pct >= 90 ? "var(--red)" : pct >= 70 ? "var(--amber)" : "var(--green)";
        const catInfo = getCatInfo(p.categoria, "gasto");

        const item = document.createElement("div");
        item.className = "budget-item";
        item.innerHTML = `
            <div class="budget-header">
                <div class="budget-name">
                    <span>${catInfo.icon}</span> ${p.categoria}
                    ${pct >= 90 ? '<span class="badge badge-red">⚠️ Límite</span>' : ""}
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                    <div class="budget-amounts">${formatMonto(gastado)} / ${formatMonto(p.limite)}</div>
                    <button style="color:var(--muted);font-size:13px;padding:2px 6px;border-radius:4px;transition:all .15s;"
                        onmouseover="this.style.color='var(--red)'"
                        onmouseout="this.style.color='var(--muted)'"
                        onclick="eliminarPresupuesto('${p.id}')">✕</button>
                </div>
            </div>
            <div class="budget-bar-wrap">
                <div class="budget-bar-fill" style="width:${pct}%;background:${color}"></div>
            </div>
            <div class="budget-pct">${pct}% utilizado</div>
        `;
        contenedor.appendChild(item);
    });
}

function poblarSelectCategorias() {
    const esGasto = document.getElementById("btn-gasto").classList.contains("active-expense");
    const tipo = esGasto ? "gasto" : "ingreso";

    const selectTx = document.getElementById("tx-cat");
    selectTx.innerHTML = "";
    (CATEGORIAS[tipo] || []).forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.nombre;
        opt.textContent = `${c.icon} ${c.nombre}`;
        selectTx.appendChild(opt);
    });

    const selectBudget = document.getElementById("budget-cat");
    selectBudget.innerHTML = "";
    (CATEGORIAS.gasto || []).forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.nombre;
        opt.textContent = `${c.icon} ${c.nombre}`;
        selectBudget.appendChild(opt);
    });
}

function agregarMovimiento() {
    const desc   = document.getElementById("tx-desc").value.trim();
    const monto  = parseFloat(document.getElementById("tx-monto").value);
    const fecha  = document.getElementById("tx-fecha").value;
    const cat    = document.getElementById("tx-cat").value;
    const metodo = document.getElementById("tx-metodo").value;
    const tipo   = document.getElementById("btn-gasto").classList.contains("active-expense") ? "gasto" : "ingreso";

    if (!desc)               { showToast("Ingresá una descripción", "error"); return; }
    if (!monto || monto <= 0){ showToast("Ingresá un monto válido", "error"); return; }
    if (!fecha)              { showToast("Seleccioná una fecha", "error"); return; }

    const nuevo = { id: generarId(), descripcion: desc, monto, fecha, categoria: cat, metodo, tipo };
    const movimientos = cargarMovimientos();
    movimientos.push(nuevo);
    guardarMovimientos(movimientos);

    document.getElementById("tx-desc").value  = "";
    document.getElementById("tx-monto").value = "";

    cerrarModal();
    renderPaginaActual();
    showToast(`${tipo === "gasto" ? "Gasto" : "Ingreso"} registrado correctamente`);
}

function eliminarMovimiento(id) {
    guardarMovimientos(cargarMovimientos().filter(m => m.id !== id));
    renderPaginaActual();
    showToast("Movimiento eliminado");
}

function agregarPresupuesto() {
    const cat   = document.getElementById("budget-cat").value;
    const monto = parseFloat(document.getElementById("budget-monto").value);

    if (!monto || monto <= 0) { showToast("Ingresá un límite válido", "error"); return; }

    const presupuestos = cargarPresupuestos();
    if (presupuestos.some(p => p.categoria === cat)) {
        showToast("Ya existe un presupuesto para esa categoría", "error");
        return;
    }

    presupuestos.push({ id: generarId(), categoria: cat, limite: monto });
    guardarPresupuestos(presupuestos);
    document.getElementById("budget-monto").value = "";
    renderPresupuestos();
    showToast("Presupuesto guardado");
}

function eliminarPresupuesto(id) {
    guardarPresupuestos(cargarPresupuestos().filter(p => p.id !== id));
    renderPresupuestos();
    showToast("Presupuesto eliminado");
}

let paginaActual = "dashboard";

function navegarA(pagina) {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    document.getElementById(`page-${pagina}`).classList.add("active");
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
    document.querySelector(`[data-page="${pagina}"]`)?.classList.add("active");
    paginaActual = pagina;
    renderPaginaActual();
    document.getElementById("sidebar").classList.remove("open");
}

function renderPaginaActual() {
    if (paginaActual === "dashboard")    renderDashboard();
    if (paginaActual === "movimientos")  { poblarFiltros(); renderMovimientos(); }
    if (paginaActual === "estadisticas") renderEstadisticas();
    if (paginaActual === "presupuestos") renderPresupuestos();
}

function abrirModal() {
    document.getElementById("overlay").classList.add("open");
    document.getElementById("tx-fecha").value = new Date().toISOString().split("T")[0];
    poblarSelectCategorias();
}

function cerrarModal() {
    document.getElementById("overlay").classList.remove("open");
}

document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", () => navegarA(item.dataset.page));
});
document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", () => navegarA(link.dataset.page));
});
document.getElementById("btn-open-modal").addEventListener("click", abrirModal);
document.getElementById("btn-close-modal").addEventListener("click", cerrarModal);
document.getElementById("overlay").addEventListener("click", (e) => {
    if (e.target === document.getElementById("overlay")) cerrarModal();
});
document.getElementById("btn-guardar-tx").addEventListener("click", agregarMovimiento);
document.getElementById("btn-guardar-budget").addEventListener("click", agregarPresupuesto);
document.getElementById("btn-gasto").addEventListener("click", () => {
    document.getElementById("btn-gasto").className   = "type-btn active-expense";
    document.getElementById("btn-ingreso").className = "type-btn";
    poblarSelectCategorias();
});
document.getElementById("btn-ingreso").addEventListener("click", () => {
    document.getElementById("btn-ingreso").className = "type-btn active-income";
    document.getElementById("btn-gasto").className   = "type-btn";
    poblarSelectCategorias();
});
document.getElementById("search-input").addEventListener("input",  renderMovimientos);
document.getElementById("filter-type").addEventListener("change",  renderMovimientos);
document.getElementById("filter-mes").addEventListener("change",   renderMovimientos);
document.getElementById("filter-cat").addEventListener("change",   renderMovimientos);
document.getElementById("hamburger").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
});
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") cerrarModal();
});

function cargarDatosEjemplo() {
    if (cargarMovimientos().length > 0) return;
    const hoy    = new Date();
    const mes    = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
    const mesN   = hoy.getMonth();
    const mesAnt = `${hoy.getFullYear()}-${String(mesN === 0 ? 12 : mesN).padStart(2, "0")}`;

    const ejemplos = [
        { descripcion: "Sueldo del mes",    monto: 150000, categoria: "Sueldo",       metodo: "Transferencia", tipo: "ingreso", fecha: `${mes}-01`    },
        { descripcion: "Freelance diseño",  monto: 35000,  categoria: "Freelance",    metodo: "Transferencia", tipo: "ingreso", fecha: `${mes}-10`    },
        { descripcion: "Alquiler",          monto: 45000,  categoria: "Alquiler",     metodo: "Transferencia", tipo: "gasto",   fecha: `${mes}-05`    },
        { descripcion: "Supermercado",      monto: 8500,   categoria: "Supermercado", metodo: "Débito",        tipo: "gasto",   fecha: `${mes}-07`    },
        { descripcion: "Netflix",           monto: 2200,   categoria: "Streaming",    metodo: "Crédito",       tipo: "gasto",   fecha: `${mes}-08`    },
        { descripcion: "Salida con amigos", monto: 4800,   categoria: "Salidas",      metodo: "Efectivo",      tipo: "gasto",   fecha: `${mes}-12`    },
        { descripcion: "Nafta",             monto: 6000,   categoria: "Combustible",  metodo: "Débito",        tipo: "gasto",   fecha: `${mes}-14`    },
        { descripcion: "Gym mensualidad",   monto: 5500,   categoria: "Gimnasio",     metodo: "Débito",        tipo: "gasto",   fecha: `${mes}-03`    },
        { descripcion: "Delivery pizza",    monto: 3200,   categoria: "Delivery",     metodo: "Mercado Pago",  tipo: "gasto",   fecha: `${mes}-16`    },
        { descripcion: "Internet",          monto: 3800,   categoria: "Internet",     metodo: "Débito",        tipo: "gasto",   fecha: `${mes}-05`    },
        { descripcion: "Sueldo anterior",   monto: 140000, categoria: "Sueldo",       metodo: "Transferencia", tipo: "ingreso", fecha: `${mesAnt}-01` },
        { descripcion: "Supermercado",      monto: 9200,   categoria: "Supermercado", metodo: "Débito",        tipo: "gasto",   fecha: `${mesAnt}-10` },
        { descripcion: "Médico",            monto: 7000,   categoria: "Salud",        metodo: "Efectivo",      tipo: "gasto",   fecha: `${mesAnt}-15` },
    ];

    guardarMovimientos(ejemplos.map(e => ({ ...e, id: generarId() })));
}

async function inicializar() {
    try {
        const response = await fetch("./data.json");
        const data = await response.json();
        CATEGORIAS = data;
        cargarDatosEjemplo();
        poblarSelectCategorias();
        renderDashboard();
    } catch (err) {
        document.getElementById("dash-title").textContent = "Error al cargar la app";
    }
}

inicializar();
